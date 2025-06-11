import ReactDOM from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import LoginPage from "./pages/login";
import AppProvider from "./context/appContext/provider";
import "./index.css";
import AuthProvider from "./context/authContext/provider";
import HomePage from "./pages/home";
import { PublicRoute } from "./components/atoms/publicRoute";
import { PrivateRoute } from "./components/atoms/privateRoute";
import AppLayout from "./layouts/appLayout";

const root = document.getElementById("root");

ReactDOM.createRoot(root!).render(
  <BrowserRouter>
    <AppProvider>
      <AuthProvider>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginPage />
                </PublicRoute>
              }
            />
            <Route
              path="/home"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
          </Routes>
        </AppLayout>
      </AuthProvider>
    </AppProvider>
  </BrowserRouter>
);
