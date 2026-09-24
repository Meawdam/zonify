FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile --dangerously-allow-all-builds

COPY . .

RUN pnpm build

EXPOSE 3000

CMD ["pnpm", "start"]