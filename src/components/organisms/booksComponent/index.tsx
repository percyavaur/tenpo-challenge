import React, { useEffect, useState } from "react";
import type { IBook } from "../../../models/Library";
import libraryServices from "../../../services/library.services";
import SelectComponent from "../../atoms/selectComponent";
import BooksTableComponent from "../../atoms/booksTableComponent";
import BooksListComponent from "../../atoms/bookListComponent";
import PaginationComponent from "../../atoms/paginationComponent";

/* 
Lista de categorías de libros con su respectivo valor (en ingles) y etiquieta (en español).
 */
const subjects = [
  { value: "thriller", label: "Suspenso" },
  { value: "love", label: "Amor" },
  { value: "fantasy", label: "Fantasía" },
  { value: "science_fiction", label: "Ciencia ficción" },
  { value: "romance", label: "Romance" },
  { value: "mystery_and_detective_stories", label: "Misterio y detectives" },
  { value: "architecture", label: "Arquitectura" },
  { value: "finance", label: "Finanzas" },
  { value: "cats", label: "Gatos" },
  { value: "cooking", label: "Cocina" },
];

/**
 * Componente que muestra una lista de libros por categoría.
 * Permite seleccionar una categoría y ver los libros correspondientes.
 * Muestra una tabla en pantallas grandes y una lista en pantallas pequeñas.
 * Uso de paginación para manejar la cantidad de libros mostrados.
 * Uso de un api publica para obtener los libros.
 */
const BooksComponent: React.FC = () => {
  const [subject, setSubject] = useState("thriller");
  const [loading, setLoading] = useState<boolean>(false);
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [books, setBooks] = useState<IBook[]>([]);
  const [paginationValues, setPaginationValues] = useState({
    limit: 10,
    offset: 0,
  });

  useEffect(() => {
    loadBooksBySubject(
      subject,
      paginationValues.limit,
      paginationValues.offset
    );
  }, [paginationValues, subject]);

  const loadBooksBySubject = async (
    subject: string,
    limit: number,
    offset: number
  ) => {
    setLoading(true);
    await libraryServices
      .fetchBooks({
        subject: subject,
        limit: limit,
        offset: offset,
      })
      .then((res) => {
        setBooks(res.data.works);
        setTotalBooks(res.data.work_count);
      })
      .catch((error) => {
        console.log("error", error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getSubjectLabel = (subject: string) =>
    subjects.find((e) => e.value === subject)?.label;

  return (
    <div>
      <div className="max-w-[240px] mb-3">
        <SelectComponent
          name="subjectlist"
          id="subjectlist"
          value={subject}
          onChange={(e) => {
            setSubject((e.target as HTMLSelectElement).value);
          }}
        >
          {subjects.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectComponent>
      </div>

      <p className="text-gray-900 dark:text-gray-100 mb-4">
        Categoría: {getSubjectLabel(subject)}
      </p>
      <div className="relative mb-4 w-full">
        {loading && (
          <div
            className="absolute z-10 w-full h-full rounded-md"
            style={{
              backdropFilter: "blur(10px)",
            }}
          >
            <p className="text-xl text-gray-900 dark:text-gray-100 text-center mt-[30%]">
              cargando ...
            </p>
          </div>
        )}
        {/* 
        Dividir el contenido en dos componentes distintos para pantallas dekstop y responsive,
        debido a que una tabla en en pantallas pequeñas es poco prácitco a comparación de una lista.
        */}
        <div className="hidden md:block">
          <BooksTableComponent books={books} />
        </div>
        <div className="block md:hidden">
          <BooksListComponent books={books} />
        </div>
      </div>
      <PaginationComponent
        limit={paginationValues.limit}
        offset={paginationValues.offset}
        total={totalBooks}
        onChange={(limit, offset) => {
          setPaginationValues({ limit, offset });
        }}
        disabled={loading}
      />
    </div>
  );
};

export default BooksComponent;
