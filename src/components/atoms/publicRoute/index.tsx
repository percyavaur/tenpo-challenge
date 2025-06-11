import React, { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "../../../context/authContext/context";

interface IProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<IProps> = ({ children }) => {
  const { isAuthenticated } = useContext(AuthContext);

  return isAuthenticated ? <Navigate to="/home" replace /> : children;
};
