export {
  createSurvey,
  createSurveyByText,
  createSurveyByJson,
  getSurvey,
  listSurveys,
  updateSurveyStatus,
  getSurveySettings,
  updateSurveySettings,
  deleteSurvey,
  getQuestionTags,
  getTagDetails,
  clearRecycleBin,
  uploadFile,
  surveyToText,
  textToSurvey,
  parsedQuestionsToWire,
} from "wjx-api-sdk";
export type { SurveyDetail, ParsedSurvey, ParsedQuestion } from "wjx-api-sdk";
