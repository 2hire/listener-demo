import fastify from 'fastify'

// import json schemas as normal
import QuerystringSchema from "./schemas/querystring.json";

// import the generated interfaces
import { QuerystringSchema as QuerystringSchemaInterface } from "./types/querystring";

const server = fastify()

const topicErrorMessage = "Topic Validation Error";
const modeErrorMessage = "hub.mode must be 'subscribe'";

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
