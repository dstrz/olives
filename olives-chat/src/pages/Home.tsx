import React, { useEffect, useState } from "react";
const Home = () => {
  const [channels, setChannels] = useState([] as string[]);

  const fetchAvailableChannels = () => {
    fetch("/api/get-topics-list")
      .then((response) => {
        return response.json();
      })
      .then((data) => {
        setChannels(data);
      });
  };

  useEffect(() => {
    fetchAvailableChannels();
  }, []);

  return channels.length ? (
    <ul>
      {channels.map((channelName, i) => (
        <li key={`channel-${i}`}>{channelName}</li>
      ))}
    </ul>
  ) : (
    <div>Loading list of channels...</div>
  );
};

export default Home;
