import React, { useState, useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import "./App.css";
import NameContext from "./name-context";
import { getDevUrl } from "./utils";

const App: React.FC<React.PropsWithChildren> = () => {
  const [name, setName] = useState("");
  useEffect(() => {
    fetch(getDevUrl("/api/get-my-name"))
      .then((response) => response.text().then(setName))
      .catch(() => {});
  }, []);
  return (
    <NameContext.Provider value={name}>
      <div className="column">
        <header>
          <Link className="header-link" to="/">
            Olives Chat
          </Link>
          <div className="user-name">You are {name}</div>
        </header>
        <main>
          <Outlet />
        </main>
      </div>
    </NameContext.Provider>
  );
};

export default App;
