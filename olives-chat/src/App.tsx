import React from "react";
import { Outlet } from "react-router-dom";

const App: React.FC<React.PropsWithChildren> = () => {
  return (
    <div className="column">
      <div>Olives Chat</div>
      <Outlet />
    </div>
  );
};

export default App;
