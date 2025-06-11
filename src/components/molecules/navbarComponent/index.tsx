import React from "react";
import ButtonComponent from "../../atoms/buttonComponent";
import { MdDarkMode, MdLightMode } from "react-icons/md";

interface IProps {
  theme: string;
  isAuthenticated?: boolean;
  onThemeChange: () => void;
  onLogout: () => void;
}

const NavbarComponent: React.FC<IProps> = (props) => {
  return (
    <nav className="h-[60px] flex flex-row justify-between items-center px-4 py-2 rounded-b-2xl border-b border-solid border-gray-500">
      <p className="text-gray-900 dark:text-gray-100 text-xl font-bold">
        Tenpo challenge
      </p>
      <div className="flex flex-row items-center space-x-4">
        <button
          onClick={props.onThemeChange}
          className="cursor-pointer text-gray-900 dark:text-gray-100"
        >
          {props.theme === "dark" ? (
            <MdLightMode size={20} />
          ) : (
            <MdDarkMode size={20} />
          )}
        </button>
        {props.isAuthenticated && (
          <ButtonComponent onClick={() => props.onLogout()}>
            Cerrar sesión
          </ButtonComponent>
        )}
      </div>
    </nav>
  );
};

export default NavbarComponent;
