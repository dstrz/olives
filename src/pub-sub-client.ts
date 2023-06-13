import { PubSub } from "@google-cloud/pubsub";

const projectId = "hackathon-team-5-388910";

const client = new PubSub({ projectId });

export default client;
