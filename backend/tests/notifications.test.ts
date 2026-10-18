import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { BookingModel } from "../src/modules/bookings/booking.schema.js";
import { NotificationModel } from "../src/modules/notifications/notification.schema.js";
import { notificationEvent } from "../src/modules/notifications/notification.event.js";
import { processNotifications, listNotifications, markNotificationRead, markAllNotificationsRead } from "../src/modules/notifications/notification.service.js";
let mongo: MongoMemoryServer;
const now = new Date("2026-10-20T10:00:00Z");
before(async () => { mongo = await MongoMemoryServer.create(); await mongoose.connect(mongo.getUri()); await Promise.all([BookingModel.init(), NotificationModel.init()]); });
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => { await BookingModel.deleteMany({}); await NotificationModel.deleteMany({}); });
async function booking(id: string, extra = {}) { return BookingModel.create({ _id:id, userId:"buyer", marketId:"m", stallId:id, date:"2026-10-21", price:100, status:"confirmed", ...extra }); }
test("outbox recovers delivery before acknowledgement and concurrent workers deduplicate", async () => {
 const event = notificationEvent("b:approved", "booking_approved", "Approved", now);
 await booking("b", { notificationEvents:[event] });
 await NotificationModel.create({ _id:event.id, userId:"buyer", bookingId:"b", type:event.type, message:event.message, createdAt:now });
 await Promise.all([processNotifications(now),processNotifications(now)]);
 assert.equal(await NotificationModel.countDocuments(),1);
 assert.ok((await BookingModel.findById("b"))!.notificationEvents[0]!.deliveredAt);
 await processNotifications(now); assert.equal(await NotificationModel.countDocuments(),1);
});
test("ownership, pagination and idempotent one/all read never affect another user", async () => {
 await booking("b", { notificationEvents:[notificationEvent("b:one", "slip_rejected", "First",now),notificationEvent("b:two","slip_rejected","Second",now)] });
 await booking("c", { userId:"other", notificationEvents:[notificationEvent("c:one","booking_approved","Other",now)] });
 await processNotifications(now);
 const page=await listNotifications("buyer",1,1,now); assert.equal(page.total,2); assert.equal(page.unreadCount,2); assert.equal(page.items.length,1);
 assert.notEqual(page.items[0]!.id,(await listNotifications("buyer",2,1,now)).items[0]!.id);
 await assert.rejects(markNotificationRead("c:one","buyer",now), {status:404});
 await markNotificationRead("b:one","buyer",now); await markNotificationRead("b:one","buyer",now);
 assert.equal((await listNotifications("buyer",1,20,now)).unreadCount,1);
 await markAllNotificationsRead("buyer",now); assert.equal((await listNotifications("buyer",1,20,now)).unreadCount,0);
 assert.equal((await listNotifications("other",1,20,now)).unreadCount,1);
});
test("reminder deduplicates per deadline and suppresses submitted slips and stale reminders",async()=>{
 const deadline=new Date(now.valueOf()+240000);
 await booking("soon",{status:"pending_payment",expiresAt:deadline});
 await booking("late",{status:"pending_payment",expiresAt:new Date(now.valueOf()+600000)});
 await booking("review",{status:"payment_review"});
 await booking("retry",{status:"pending_payment",expiresAt:deadline,paymentAttempts:[{id:"a",status:"rejected"}]});
 await Promise.all([processNotifications(now),processNotifications(now)]);
 let results=await listNotifications("buyer",1,20,now); assert.equal(results.total,1); assert.equal(results.items[0]!.bookingId,"soon");
 assert.equal(await NotificationModel.countDocuments(),1);
 assert.equal((await listNotifications("buyer",1,20,new Date(deadline.valueOf()+1))).total,0);
 await BookingModel.updateOne({_id:"soon"},{$set:{status:"payment_review",expiresAt:null},$push:{paymentAttempts:{id:"new",status:"review"}}});
 results=await listNotifications("buyer",1,20,now); assert.equal(results.total,0); assert.equal(results.unreadCount,0);
});
test("payment decisions atomically retain distinct rejected-attempt, approval and refund events", async () => {
 process.env.JWT_SECRET = "notification-test-secret-with-at-least-32-characters"; process.env.MONGO_URI = mongo.getUri();
 const { reviewPayment, recordRefund } = await import("../src/modules/payments/payment.service.js");
 await booking("pay", {status:"payment_review",paymentAttempts:[{id:"first",status:"review",amount:100,slipHash:"hash1"}]});
 await reviewPayment("pay","manager",{attemptId:"first",decision:"reject",reason:"Not readable"},now);
 assert.equal((await BookingModel.findById("pay"))!.notificationEvents.length,1);
 await BookingModel.updateOne({_id:"pay"},{$set:{status:"payment_review"},$push:{paymentAttempts:{id:"second",status:"review",amount:100,slipHash:"hash2"}}});
 await reviewPayment("pay","manager",{attemptId:"second",decision:"approve",verifiedReference:"REFERENCE1"},now);
 await BookingModel.updateOne({_id:"pay"},{$set:{status:"cancelled",refund:{status:"pending",amount:100,requestedAt:now}}});
 await recordRefund("pay","manager","REFUND1",now); await recordRefund("pay","manager","REFUND1",now);
 await processNotifications(now);
 assert.deepEqual((await listNotifications("buyer",1,20,now)).items.map(n=>n.type).sort(),["booking_approved","refund_completed","slip_rejected"]);
});

test("HTTP endpoints require authentication and Origin, reject extra fields, and hide other owners",async()=>{
 const [{default:express},{once},{UserModel},{issueSession},{requireOrigin},{errorHandler},{default:router}] = await Promise.all([
   import("express"),import("node:events"),import("../src/modules/users/schema/user.schema.js"),import("../src/modules/users/session.js"),
   import("../src/middlewares/request-security.js"),import("../src/middlewares/error-handler.js"),import("../src/modules/notifications/notification.route.js")]);
 const user=await UserModel.create({name:"Buyer",email:"notify@example.test",password:"unused"});
 const app=express(); app.use(express.json()); app.get("/session",async(_req,res)=>{await issueSession(res,String(user._id),0);res.json({ok:true});}); app.use("/notifications",requireOrigin,router);app.use(errorHandler);
 const server=app.listen(0,"127.0.0.1");await once(server,"listening");const address=server.address();assert(address&&typeof address!=="string");const base=`http://127.0.0.1:${address.port}`;
 try {
  const session=await fetch(base+"/session");const cookie=session.headers.get("set-cookie")!.split(";")[0]!;
  assert.equal((await fetch(base+"/notifications")).status,401);
  const headers={Cookie:cookie,Origin:"http://localhost:3000","Content-Type":"application/json"};
  assert.equal((await fetch(base+"/notifications?page=0",{headers})).status,400);
  assert.equal((await fetch(base+"/notifications?userId=buyer",{headers})).status,400);
  assert.equal((await fetch(base+"/notifications/read-all",{method:"POST",headers:{Cookie:cookie,"Content-Type":"application/json"},body:"{}"})).status,403);
  assert.equal((await fetch(base+"/notifications/read-all",{method:"POST",headers,body:'{"userId":"buyer"}'})).status,400);
  await NotificationModel.create({_id:"private",userId:"other",bookingId:"b",type:"booking_approved",message:"secret",createdAt:now});
  assert.equal((await fetch(base+"/notifications/private/read",{method:"POST",headers,body:"{}"})).status,404);
  const list=await fetch(base+"/notifications",{headers});assert.equal(list.headers.get("cache-control"),"no-store");assert.equal((await list.json()).total,0);
 } finally {server.close();await once(server,"close");}
});
