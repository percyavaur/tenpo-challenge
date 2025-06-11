import React, { useEffect, useState } from "react";
import { AppContext } from "./context";

const AppProvider: React.FC<{ children: React.ReactNode }> = (props) => {
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem("tenpo-theme");
    if (savedTheme) return savedTheme;

    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("dark", "light");
    root.classList.add(theme);
    localStorage.setItem("tenpo-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "light" ? "dark" : "light"));
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme }}>
      {props.children}
    </AppContext.Provider>
  );
};

export default AppProvider;
