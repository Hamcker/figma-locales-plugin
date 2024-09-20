import { RestClient } from './rest-client.service';
import { localeFilterExpression, LOCALES_COLLECTION_NAME, URLS } from '../constants';
import { GetLocalesResponse, Language, ServiceResponse } from '../types';

export class ImportExportService {
   constructor(private restClient: RestClient) {}

   private static instance(): ImportExportService {
      const restClient = new RestClient();
      return new ImportExportService(restClient);
   }

   static async handleImportMessage() {
      const importExportService = ImportExportService.instance();
      
      //! IMPORTANT:
      // Please keep this order and do not use for loop. It's very important to keep en-US at the beginning since the figma doesn't let
      // to define a variable without a mode. So, the first mode should be en-US. and en-US is actually the Mode 1 which has been renamed to en-US.
      // Also for better read, we should keep the order as en-US, tr-TR, de-DE, ar-SA
      //! Since the license doesn't let to define more than 4 modes, we can't add more languages!
      await importExportService.importLocale(Language.EN_US);
      await importExportService.importLocale(Language.TR_TR);
      await importExportService.importLocale(Language.DE_DE);
      await importExportService.importLocale(Language.AR_SA);
      
   }

   static async handleExportMessage() {
      // not implemented
   }

   async importLocale(language: Language) {
      const { filteredResult } = (await this.getLocalesFor(language)) ?? {
         filteredResult: [],
      };

      figma.notify(`${filteredResult.length} items with Mod_ or Com_ prefix found.`);

      console.log('importLocale()', { language, filteredResult });

      const collection = await this.getLocalesCollection();

      await this.createOrUpdateVariables(collection, filteredResult, language);
   }

   private async getLocalesFor(language: Language) {
      const response = await this.restClient.post(URLS.getLocalesByLanguage(), {
         languageCultureCode: language,
      });
      const { type, value, message } = (await response.json()) as ServiceResponse<GetLocalesResponse[]>;

      if (type !== 'Ok') {
         figma.notify('An error occurred while importing locales.');
         console.error('An error occurred while importing locales.', message);
         return;
      }

      const filteredResult = value.filter(localeFilterExpression);

      console.log('importLocale()', {
         message,
         type,
         rawCount: value.length,
         filteredCount: filteredResult.length,
      });

      return { filteredResult };
   }

   private async getLocalesCollection() {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      let collection = collections.find((c) => c.name === LOCALES_COLLECTION_NAME);

      if (!collection) {
         collection = figma.variables.createVariableCollection(LOCALES_COLLECTION_NAME);

         this.emptyCollection(collection);
      }

      return collection;
   }

   private async emptyCollection(collection: VariableCollection) {
      this.removeVariables(collection);
      this.removeModes(collection);
      collection.renameMode(collection.defaultModeId, Language.EN_US);
   }

   private removeModes(collection: VariableCollection) {
      collection.modes.forEach((mode, index) => {
         if (index === 0) {
            collection.renameMode(collection.defaultModeId, Language.EN_US);
            return;
         }

         collection.removeMode(mode.modeId);
      });
   }

   private removeVariables(collection: VariableCollection) {
      collection.variableIds.forEach(async (variableId) =>
         (await figma.variables.getVariableByIdAsync(variableId))?.remove()
      );
   }

   private async createOrUpdateVariables(
      collection: VariableCollection,
      resources: GetLocalesResponse[],
      language: Language
   ) {
      let mode = collection.modes.find((mode) => mode.name === language);
      if (!mode) {
         const outlet = collection.addMode(language);
         console.log('createOrUpdateVariables() - addMode', { language, outlet });

         mode = collection.modes.find((mode) => mode.name === language);
      }
      if (!mode?.modeId) {
         figma.notify('An error occurred while creating mode.', { error: true });
         console.error('An error occurred while creating mode.', { mode });
         return;
      }

      console.log('createOrUpdateVariables()', { collection, resources, language, mode });
      

      const variables = await this.getVariablesByCollectionId(collection.id);
      if (!variables) {
         figma.notify('An error occurred while getting variables. The collection may not exist.', { error: true });
         console.error('An error occurred while getting variables. The collection may not exist.', {
            collection,
            resources,
            language,
         });
         return;
      }

      resources.forEach((resource) => {
         const normalizeResourceKey = this.normalizeResourceKey(resource.resourceKey);
         if (this.doesVariableExist(variables, normalizeResourceKey)) {
            const variable = variables.find((v) => v.name === normalizeResourceKey);

            variable?.setValueForMode(mode.modeId, resource.translation);
         } else {
            try {
               const variable = figma.variables.createVariable(normalizeResourceKey, collection, 'STRING');

               variable.setValueForMode(mode.modeId, resource.translation);
            } catch (error) {
               console.error('An error occurred while creating variable.', { resource, error });
            }
         }
      });
   }

   private async getVariablesByCollectionId(collectionId: string) {
      return (await figma.variables.getLocalVariablesAsync()).filter((v) => v.variableCollectionId === collectionId);
   }

   private doesVariableExist(variables: Variable[], resourceKey: string) {
      return variables.find((v) => v.name === resourceKey);
   }

   private normalizeResourceKey(resourceKey: string) {
      return resourceKey.replace(/\./gim, '_');
   }
}
