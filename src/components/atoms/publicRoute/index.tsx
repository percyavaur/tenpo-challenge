import React, { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "../../../context/authContext/context";

interface IProps {
  children: React.ReactNode;
}

export const PublicRoute: React.FC<IProps> = ({ children }) => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="text-xl text-gray-900 dark:text-gray-100 mb-4 font-bold">
        Cargando...
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/home" replace /> : children;
};
