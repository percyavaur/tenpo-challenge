import React, { useContext } from "react";
import NavbarComponent from "../../components/molecules/navbarComponent";
import { AuthContext } from "../../context/authContext/context";
import { AppContext } from "../../context/appContext/context";

interface IProps {
  children?: React.ReactNode;
}

const AppLayout: React.FC<IProps> = ({ children }) => {
  const { isAuthenticated, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useContext(AppContext);

  return (
    <div className="max-w-[1440px] mx-auto">
      <NavbarComponent
        isAuthenticated={isAuthenticated}
        theme={theme}
        onLogout={() => {
          logout();
        }}
        onThemeChange={toggleTheme}
      />
      <div>{children}</div>
    </div>
  );
};

export default AppLayout;
