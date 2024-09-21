import { RestClient } from './rest-client.service';
import { localeFilterExpression, LOCALES_COLLECTION_NAME, URLS, variableFilterExpression } from '../constants';
import { GetLocalesResponse, Language, ServiceResponse } from '../types';
import { catchError, filter, finalize, firstValueFrom, from, map, mergeMap, Observable, of, tap, toArray } from 'rxjs';

export class ImportExportService {
   modes: Record<string, string> = {};

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
      const service = ImportExportService.instance();
      const collection = await service.getLocalesCollection();
      const newVariables = (await service.getNewlyAddedVariables(collection)).filter(variableFilterExpression);

      if (newVariables.length === 0) {
         figma.notify('No new variables found to export. Consider adding new variables with Mod_ or Com_ prefix.');
         console.log('handleExportMessage()', { newVariables });

         return;
      }

      service.modes = Object.fromEntries(collection.modes.map((x) => [x.modeId, x.name]));

      from(newVariables)
         .pipe(
            mergeMap((variable) => of(variable).pipe(service.addOrUpdateLocale()), 5),
            mergeMap(() => from(service.clearCache())),
            catchError((error) => {
               figma.notify('An error occurred while exporting locales.', { error: true });
               console.error('An error occurred while exporting locales.', error);
               return of(error);
            }),
            finalize(() => figma.notify('Export completed.'))
         )
         .subscribe();
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
               variable.setPluginData('AnyWork_defined', 'true');
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

   private async getNewlyAddedVariables(collection: VariableCollection) {
      const newVariables = (await this.getVariablesByCollectionId(collection.id)).filter(
         (x) => x.getPluginData('AnyWork_defined') !== 'true'
      );
      console.log('getNewlyAddedVariables()', { newVariables });
      return newVariables;
   }

   private addOrUpdateLocale() {
      return (source: Observable<Variable>) =>
         source.pipe(
            mergeMap((variable) =>
               from(Object.entries(variable.valuesByMode).map(([modeId, translation]) => ({ modeId, translation, variable })))
            ),
            filter(({ variable, modeId }) => !variable.getPluginData(`AnyWork_defined_${modeId}`)),
            mergeMap(({ variable, modeId, translation }) => {
               console.log('===', { variable, modeId, modeName: this.modes[modeId], translation });
               
               return from(
                  this.restClient.post(URLS.updateLocale(), {
                     resourceKey: variable.name,
                     languageCultureCode: this.modes[modeId],
                     translation: translation,
                  })
               ).pipe(
                  mergeMap((response) => from(response.json() as Promise<ServiceResponse<GetLocalesResponse[]>>)),
                  map(({ type }) => ({ type, modeId, translation, variable }))
               );
            }),
            tap(({ type, modeId, variable }) => {
               if (type === 'Ok') {
                  variable.setPluginData(`AnyWork_defined_${modeId}`, 'true');
               }
            })
         );
   }

   private async clearCache() {
      return this.restClient.post(URLS.clearCache(), {});
   }
}
