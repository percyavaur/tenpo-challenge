import React from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import InputComponent from "../../atoms/inputComponent";
import ButtonComponent, {
  ButtonVariantEnum,
} from "../../atoms/buttonComponent";

interface IProps {
  disabled?: boolean;
  onSubmit: (values: ILoginFormValues) => void;
}

interface ILoginFormValues {
  email: string;
  password: string;
}

const LoginFormComponent: React.FC<IProps> = (props) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ILoginFormValues>();

  const onSubmit: SubmitHandler<ILoginFormValues> = (values) => {
    props.onSubmit(values);
  };

  return (
    <form className="flex flex-col space-y-3" onSubmit={handleSubmit(onSubmit)}>
      <InputComponent
        type="email"
        label="Correo electrónico"
        placeholder="ejemplo@correo.com"
        errorMessage={errors?.email?.message}
        disabled={props.disabled}
        {...register("email", { required: "Correo electrónico obligatório" })}
      />
      <InputComponent
        type="password"
        label="Contraseña"
        placeholder="********"
        errorMessage={errors?.password?.message}
        disabled={props.disabled}
        {...register("password", { required: "Contraseña obligatória" })}
      />
      <ButtonComponent
        type="submit"
        variant={ButtonVariantEnum.primary}
        disabled={props.disabled}
      >
        Iniciar sesión
      </ButtonComponent>
    </form>
  );
};

export default LoginFormComponent;
