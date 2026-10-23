/** Minúsculas y sin tildes, para que "drogueria" encuentre "Droguería". */
export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
