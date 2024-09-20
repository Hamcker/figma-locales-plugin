type TokenMessage = {
  type: "save-token";
  token: string;
};

type ImportMessage = {
  type: "import";
};

type ExportMessage = {
  type: "export";
};

export type Message = TokenMessage | ImportMessage | ExportMessage;

export enum Language {
    EN_US = "en-US",
    TR_TR = "tr-TR",
    AR_SA = "ar-SA",
    DE_DE = "de-DE"
}

export type ServiceResponse<T> = {
  type: string;
  value: T;
  message: string;
};

export type GetLocalesResponse = {
  resourceKey: string;
  languageCultureCode: string;
  translation: string;
};
