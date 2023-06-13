const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  dateStyle: "medium",
  timeStyle: "medium",
});

export const isDev = () => process.env.NODE_ENV === "development";
export const getDevUrl = (url: string) =>
  (isDev() ? "http://localhost" : "") + url;
export const formatDate = (date: Date) => dateFormatter.format(date);
