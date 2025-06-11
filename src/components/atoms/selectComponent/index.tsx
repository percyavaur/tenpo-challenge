import React, { type SelectHTMLAttributes } from "react";
import { MdKeyboardArrowDown } from "react-icons/md";

interface IProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

const SelectComponent = React.forwardRef<HTMLSelectElement, IProps>(
  ({ label, className, children, ...selectProps }, ref) => {
    return (
      <div className="flex flex-col">
        {label && (
          <p className="font-bold mb-1 text-black dark:text-white">{label}</p>
        )}
        <div
          className={`relative border border-black border-solid rounded-md pr-2 bg-white ${className}`}
        >
          <select
            ref={ref}
            className={`rounded-md w-full p-2 pr-4 h-[48px] focus:outline-none bg-transparent cursor-pointer`}
            {...selectProps}
          >
            {children}
          </select>
          <div className="w-fit h-fit absolute top-[50%] -translate-y-[50%] right-1">
            <MdKeyboardArrowDown />
          </div>
        </div>
      </div>
    );
  }
);

export default SelectComponent;
