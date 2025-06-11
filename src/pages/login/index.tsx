import React, { useContext } from "react";
import LoginFormComponent from "../../components/molecules/loginFormComponent";
import { AuthContext } from "../../context/authContext/context";

const LoginPage: React.FC = () => {
  const { login } = useContext(AuthContext);

  const handleLogin = async (values: { email: string; password: string }) => {
    await login(values.email, values.password);
  };

  return (
    <div className="px-4 md:px-0 mt-[15vh]">
      <div className="w-full max-w-[420px] mx-auto bg-gray-100 dark:bg-gray-800 p-4 rounded-md border border-solid border-gray-500">
        <p className="text-xl text-gray-900 dark:text-gray-100 mb-4 font-bold">
          Iniciar sesión
        </p>
        <LoginFormComponent onSubmit={(values) => handleLogin(values)} />
      </div>
    </div>
  );
};

export default LoginPage;
