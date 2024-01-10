// const { XMLParser} = require("fast-xml-parser");
import { XMLParser } from "fast-xml-parser";

export function jsonifyChiliResponse(response) {
    const fastXmlParser = new XMLParser({
        ignoreAttributes: false,
        attrNodeName: false,
        attributeNamePrefix: "",
    });

    let data = fastXmlParser.parse(response);
    const firstKeys = Object.keys(data);
    if (firstKeys.length == 1) {
        if (typeof data[firstKeys[0]] == "object") {
            data = data[firstKeys[0]];
        }
    }
    return data;
}