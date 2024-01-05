import {startTests} from "./testRunner"
import { reporter } from "./reporting"

process.argv

const jsonFile = getJSONFile()

verifyJSON(jsonFile)

await startTests(jsonFile, reporter)