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
  channelName: string,
  userId: string
): Promise<Subscription | null> {
  const subscriptionName = `${channelName}-user-${userId}`;

  try {
    const subscription = client.subscription(subscriptionName);

    const [isSubscriptionActive] = await subscription.exists();
    if (isSubscriptionActive) {
      console.log("sub found:", subscription.name);
      return subscription;
    }

    return createSubscription(channelName, subscriptionName);
  } catch (error) {
    console.error("unknown error when getting subscription", error);
    return null;
  }
}

export async function removeSubscription(subscriptionName: string) {
  try {
    // const subscription = client.subscription(subscriptionName);
    // await subscription.close();
    // await subscription.delete();
  } catch (error) {
    console.log("couldn't remove subscription", error);
  }
}

export async function createSubscription(
  channelName: string,
  subscriptionName: string
): Promise<Subscription | null> {
  try {
    const [result] = await client.createSubscription(
      channelName,
      subscriptionName,
      {
        enableMessageOrdering: true,
      }
    );

    console.log(`creating sub for ${channelName} with name ${subscriptionName}`);

    return result;
  } catch (error) {
    console.error("failed to create subscription", error);
  }

  return null;
}

export default client;
