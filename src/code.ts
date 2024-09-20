import '@abraham/reflection';
import { ImportExportService } from './services/import-export.service';
import { TokenService } from './services/token.service';
import { Message } from "./types";

figma.showUI(__html__, {
  title: "AnyWork Locales Bridge",
  width: 400,
  height: 280,
});

figma.ui.onmessage = (msg: Message) => {
  switch (msg.type) {
    case "save-token":
      TokenService.saveToken(msg.token);
      break;

    case "import":
      ImportExportService.handleImportMessage();
      break;

    case "export":
      ImportExportService.handleExportMessage();
      break;
  }
};

TokenService.postTokenToUi();

