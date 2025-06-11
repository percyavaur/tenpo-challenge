import React, { useContext } from "react";
import { Navigate } from "react-router";
import { AuthContext } from "../../../context/authContext/context";

interface IProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<IProps> = ({ children }) => {
  const { isAuthenticated, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="text-xl text-gray-900 dark:text-gray-100 pl-4 pt-4 mb-4 font-bold">
        Cargando...
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};
