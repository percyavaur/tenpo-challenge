import React from "react";

export enum ButtonVariantEnum {
  primary,
  secondary,
  success,
  danger,
  warning,
  info,
}

interface IProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariantEnum;
  loading?: boolean;
}

const ButtonComponent = React.forwardRef<HTMLButtonElement, IProps>(
  ({ variant = ButtonVariantEnum.primary, children, ...buttonProps }, ref) => {
    const drawVariantClass = (variant?: ButtonVariantEnum) => {
      switch (variant) {
        case ButtonVariantEnum.primary:
          return "bg-blue-500 text-white";

        case ButtonVariantEnum.secondary:
          return "bg-gray-500 text-white";

        case ButtonVariantEnum.success:
          return "bg-green-500 text-white";

        case ButtonVariantEnum.danger:
          return "bg-red-500 text-white";

        case ButtonVariantEnum.warning:
          return "bg-yellow-500 text-black";

        case ButtonVariantEnum.info:
          return "bg-cyan-500 text-white";
      }
    };

    return (
      <>
        <button
          ref={ref}
          className={`rounded-md h-[48px] p-2 border border-solid border-black cursor-pointer ${drawVariantClass(
            variant
          )}`}
          {...buttonProps}
        >
          {children}
        </button>
      </>
    );
  }
);

export default ButtonComponent;
