import fastify from 'fastify'
import fastifyRawBody from "fastify-raw-body";

// import json schemas as normal
import QuerystringSchema from "./schemas/querystring.json";
import HeadersSchema from "./schemas/headers.json";
import BodySchema from "./schemas/body.json";

// import the generated interfaces
import { QuerystringSchema as QuerystringSchemaInterface } from "./types/querystring";
import { HeadersSchema as HeadersSchemaInterface } from "./types/headers";
import { BodySchema as BodySchemaInterface } from "./types/body";

import * as crypto from "crypto";

const server = fastify()

const topicErrorMessage = "Topic Validation Error";
const modeErrorMessage = "hub.mode must be 'subscribe'";
const signatureErrorMessage = "Signature is not valid";
const SECRET = "A secret of your choice";

enum Algorithm {
    sha256 = "sha256",
}

const generateSignature = (message: string, secret: string, algorithm: string): string => {
    if (!secret) {
        return "";
    }
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(message, "utf8");
    return `${algorithm}=${hmac.digest("hex")}`;
};

type Signal =
    | "online"
    | "position"
    | "distance_covered"
    | "autonomy_percentage"
    | "autonomy_meters"
    | "*";
const signal_name = new Set<Signal>([
    "online",
    "position",
    "distance_covered",
    "autonomy_percentage",
    "autonomy_meters",
    "*",
]);
function isSignal(signal: string): signal is Signal {
    return signal_name.has(signal as Signal);
}

let splitted: string[];
function isTopicValid(topic: string): boolean {
    splitted = topic.split(":");
    return (
        splitted.length === 4 &&
        splitted[0] === "vehicle" &&
        splitted[2] === "generic" &&
        isSignal(splitted[3])
    );
}

server.get('/hello', async (request, reply) => {
  return 'World\n'
})

server.listen(8080, (err, address) => {
  if (err) {
    console.error(err)
    process.exit(1)
  }
  console.log(`Server listening at ${address}`)
})

server.register(require("fastify-raw-body"), {
    field: "rawBody",
    global: false,
    encoding: "utf-8",
    runFirst: true,
});

server.get<{
    Querystring: QuerystringSchemaInterface;
}>(
    "/listener",
    {
        schema: {
            querystring: QuerystringSchema,
        },
        preValidation: async (request, reply) => {
            const {
                "hub.mode": mode,
                "hub.topic": topic,
            } = request.query;
            if (!isTopicValid(topic)) {
                console.error(topicErrorMessage);
                throw new Error(topicErrorMessage);
            }
            if (mode !== "subscribe") {
                console.error(modeErrorMessage);
                throw new Error(modeErrorMessage);
            }
        },
    },
    async (request, reply) => {
        console.log(" ");
        console.log(
            "Hello, you have subscribed to get information about the topic: " +
                request.query["hub.topic"],
        );
        console.log("The challenge string is: " + request.query["hub.challenge"]);
        return request.query["hub.challenge"];
    },
);

server.post<{
    Headers: HeadersSchemaInterface;
    Body: BodySchemaInterface;
}>(
    "/listener",
    {
        schema: {
            headers: HeadersSchema,
            body: BodySchema,
        },
        config: {
            rawBody: true,
        },
        preValidation: async (request, reply) => {
            const x_hub_signature = request.headers["x-hub-signature"];
            const signature = generateSignature(
                request.rawBody as string,
                SECRET,
                Algorithm.sha256,
            );
            if (!isTopicValid(request.body.topic)) {
                console.error(topicErrorMessage);
                throw new Error(topicErrorMessage);
            }
            if (x_hub_signature !== signature) {
                console.error(signatureErrorMessage);
                throw new Error(signatureErrorMessage);
            }
        },
    },
    async (request, reply) => {
        console.log(" ");
        console.log("SIGNATURE:         ", request.headers["x-hub-signature"]);
        console.log("VEHICLE:           ", splitted[1]);
        console.log("SIGNAL TYPE:       ", splitted[2]);
        console.log("SIGNAL NAME:       ", splitted[3]);
        if (splitted[3] === "position") {
            console.log("VALUE:             ");
            console.log("   Latitude:       ", request.body.payload.data.latitude);
            console.log("   Longitude:      ", request.body.payload.data.longitude);
        }
        if (splitted[3] === "autonomy_percentage") {
            console.log("VALUE:             ", request.body.payload.data.percentage);
        }
        if (splitted[3] === "autonomy_meters") {
            console.log("VALUE:             ", request.body.payload.data.meters);
        }
        if (splitted[3] === "distance_covered") {
            console.log("VALUE:             ", request.body.payload.data.meters);
        }
        if (splitted[3] === "online") {
            console.log("VALUE:             ", request.body.payload.data.online);
        }
        return {};
    },
);
