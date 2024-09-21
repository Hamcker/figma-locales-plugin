import { GetLocalesResponse } from "./types";

export const basePath = "https://b1-de.anywork.gmbh/vulcan";

export const URLS = {
  getLocalesByLanguage: () =>
    `${basePath}/languageresource/GetAllLanguageResource`,
  updateLocale: () => `${basePath}/languageresource/UpdateLanguageResource`,
  clearCache: () => `${basePath}/languageresource/ClearLanguageResourceCahce`,
};

export const localeFilterExpression = (item: GetLocalesResponse) =>
  item.resourceKey.startsWith("Mod_") || item.resourceKey.startsWith("Com_") || item.resourceKey.startsWith("Common.");

export const variableFilterExpression = (item: Variable) =>
  item.name.startsWith("Mod_") || item.name.startsWith("Com_") || item.name.startsWith("Common.");

export const LOCALES_COLLECTION_NAME = "Locales";