import swaggerJSDoc from "swagger-jsdoc";

const swaggerOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: "3.0.0",

    info: {
      title: "My Project API",
      version: "1.0.0",
      description: "API documentation for My Project",
    },

    servers: [
      {
        url: "http://localhost:3000",
      },
    ],

    components: {
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              example: "68d123456789abcdef123456",
            },
            name: {
              type: "string",
              example: "Meaw",
            },
            email: {
              type: "string",
              format: "email",
              example: "meaw@example.com",
            },
          },
        },

        CreateUser: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: {
              type: "string",
              example: "Meaw",
            },
            email: {
              type: "string",
              format: "email",
              example: "meaw@example.com",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "123456",
            },
          },
        },

        LoginUser: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "meaw@example.com",
            },
            password: {
              type: "string",
              format: "password",
              example: "123456",
            },
          },
        },

        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              example: "User not found",
            },
          },
        },
      },

      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
  },

  apis: ["./src/modules/**/*.ts"],
};

export const swaggerSpec = swaggerJSDoc(swaggerOptions);