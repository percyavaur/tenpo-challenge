import React from "react";

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  prefix?: string;
  errorMessage?: string;
  infoMessage?: string;
}

const InputComponent = React.forwardRef<HTMLInputElement, IProps>(
  (
    { label, className, prefix, errorMessage, infoMessage, ...inputProps },
    ref
  ) => {
    const isError = !!errorMessage;
    const isDisabled = inputProps.disabled;

    return (
      <div className="flex flex-col space-y-1">
        {label && (
          <p className="font-bold mb-1 text-black dark:text-white">{label}</p>
        )}
        <div
          className={`flex flex-row items-center rounded-md border border-solid
            ${isError ? "border-red-500" : "border-black"} 
            ${!isDisabled ? "bg-white" : "bg-gray-300"}
          `}
        >
          {prefix && <p className="ml-2">{prefix}</p>}
          <input
            ref={ref}
            className={`rounded-md h-[48px] p-2 focus:outline-none w-full bg-transparent ${className}`}
            {...inputProps}
          />
        </div>
        {isError && (
          <p className="text-red-600 dark:text-red-400 text-sm mt-2">
            {" "}
            - {errorMessage}
          </p>
        )}
        {!isError && infoMessage && (
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-2">
            {infoMessage}
          </p>
        )}
      </div>
    );
  }
);

export default InputComponent;
