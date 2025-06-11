import React, { useState } from "react";
import { AuthContext } from "./context";
import type { IUser } from "../../models/User";
import authServices from "../../services/auth.services";
import { useNavigate } from "react-router";

const AuthProvider: React.FC<{ children: React.ReactNode }> = (props) => {
  const token = sessionStorage.getItem("tenpo-token");
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!token);
  const [user, setUser] = useState<IUser>();
  const [loading, setLoading] = useState<boolean>(false);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const { token, user } = await authServices.fakeLoginService(
        email,
        password
      );
      sessionStorage.setItem("tenpo-token", token);
      setIsAuthenticated(true);
      setUser(user);
      navigate("/home");
    } catch (error) {
      console.log("error", error);
    }
    setLoading(false);
  };

  const logout = () => {
    sessionStorage.removeItem("tenpo-token");
    setIsAuthenticated(false);
    setUser(undefined);
    navigate("/login");
  };

  return (
    <AuthContext
      value={{
        isAuthenticated,
        user,
        login,
        logout,
        loading,
      }}
    >
      {props.children}
    </AuthContext>
  );
};

export default AuthProvider;
