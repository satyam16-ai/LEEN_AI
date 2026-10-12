import { createContext, useContext } from 'react';

export const FormFieldContext = createContext(null);

/** Lets inputs pick up id / aria-invalid / aria-describedby from the surrounding FormField. */
export function useFormField() {
  return useContext(FormFieldContext);
}
