import React from "react";
import type { IBook } from "../../../models/Library";

interface IProps {
  books: IBook[];
}

const BooksListComponent: React.FC<IProps> = ({ books }) => {
  const getAuthors = (book: IBook) => {
    return book.authors.map((a) => a.name).join(", ");
  };

  return (
    <div className="text-gray-900 dark:text-gray-100 w-full">
      <div className="border border-gray-400 dark:border-gray-500 border-solid rounded-md divide-y divide-gray-300 dark:divide-gray-600">
        {books.map((book) => (
          <div key={book.key} className="p-4">
            <h3 className="font-semibold">{book.title}</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-[350px]">
              <span className="font-medium">Autor(es): </span>
              {getAuthors(book)}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <span className="font-medium">Ediciones: </span>
              {book.edition_count}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BooksListComponent;
