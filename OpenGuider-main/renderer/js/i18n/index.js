import { formatTr, tr } from "./tr.js";

let activeLocale = tr;

export function t(key, vars) {
  const value = activeLocale[key] ?? key;
  return vars ? formatTr(value, vars) : value;
}

export function applyI18nToDocument(doc = document) {
  doc.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    const attr = element.getAttribute("data-i18n-attr");
    const text = t(key);
    if (attr) {
      element.setAttribute(attr, text);
    } else {
      element.textContent = text;
    }
  });

  doc.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", t(element.getAttribute("data-i18n-placeholder")));
  });
}

export { tr, formatTr };
