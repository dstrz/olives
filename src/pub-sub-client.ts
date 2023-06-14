import { PubSub, Subscription, Topic } from "@google-cloud/pubsub";

const projectId = "hackathon-team-5-388910";

const client = new PubSub({ projectId });

export const getTopics = () =>
  client
    .getTopics()
    .then((response) =>
      response.flatMap((x: Topic[]) => x.map((t) => t.name.split("/").at(-1)))
    );

export async function getOrCreateSubscription(
  channelName: string
): Promise<Subscription | null> {
  const subName = `subscription-for-channel-${channelName}`;

  try {
    const subscription = client.subscription(subName);

    console.log("getting sub status...");
    const [isSubscriptionActive] = await subscription.exists();

    console.log("getting sub status result", isSubscriptionActive);

    if (isSubscriptionActive) {
      return subscription;
    }

    return createSubscription(channelName, subName);
  } catch (error) {
    console.error("unknown error when getting subscription", error);
    return null;
  }
}

export async function createSubscription(
  channelName: string,
  subscriptionName: string
): Promise<Subscription | null> {
  try {
    console.log("creating subscription");
    const [result] = await client.createSubscription(
      channelName,
      subscriptionName,
      {
        enableMessageOrdering: true,
      }
    );

    return result;
  } catch (error) {
    console.error("failed to create subscription", error);
  }

  return null;
}

export default client;
