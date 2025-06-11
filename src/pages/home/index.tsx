import React from "react";
import BooksComponent from "../../components/organisms/booksComponent";

const HomePage: React.FC = () => {
  return (
    <div className="my-6">
      <div className="px-2 md:px-4 w-fyll max-w-[720px] mx-auto">
        <p className="text-xl text-gray-900 dark:text-gray-100 mb-4 font-bold">
          Libros por categoría
        </p>
        <BooksComponent />
      </div>
    </div>
  );
};

export default HomePage;
