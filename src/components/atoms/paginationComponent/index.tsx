import React from "react";
import SelectComponent from "../selectComponent";
import ButtonComponent, { ButtonVariantEnum } from "../buttonComponent";

interface IProps {
  limit: number;
  offset: number;
  total: number;
  onChange: (limit: number, offset: number) => void;
  disabled?: boolean;
}

const PaginationComponent: React.FC<IProps> = ({
  limit,
  offset,
  total,
  onChange,
  disabled,
}) => {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const handlePrev = () => onChange(limit, Math.max(0, offset - limit));
  const handleNext = () =>
    onChange(limit, Math.min((totalPages - 1) * limit, offset + limit));
  const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLimit = Number(e.target.value);
    onChange(newLimit, 0);
  };

  return (
    <div className="flex items-center justify-between w-full md:max-w-[420px] gap-4 text-gray-900 dark:text-gray-100">
      <ButtonComponent
        variant={ButtonVariantEnum.secondary}
        onClick={handlePrev}
        disabled={offset === 0 || disabled}
      >
        Anterior
      </ButtonComponent>
      <span className="text-sm md:text-base">
        {currentPage} / {totalPages}
      </span>
      <ButtonComponent
        variant={ButtonVariantEnum.secondary}
        onClick={handleNext}
        disabled={offset + limit >= total || disabled}
      >
        Siguiente
      </ButtonComponent>
      <SelectComponent
        value={limit}
        onChange={handleLimitChange}
        className="text-black"
        disabled={disabled}
      >
        {[10, 20, 50, 100].map((n) => (
          <option key={n} value={n}>
            {n} / pág.
          </option>
        ))}
      </SelectComponent>
    </div>
  );
};

export default PaginationComponent;
