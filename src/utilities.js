export function jsonifyChiliResponse(response) {
    let data = fastXmlParser.parse(response, {
        ignoreAttributes: false,
        attrNodeName: false,
        attributeNamePrefix: "",
    });
    const firstKeys = Object.keys(data);
    if (firstKeys.length == 1) {
        if (typeof data[firstKeys[0]] == "object") {
            data = data[firstKeys[0]];
        }
    }
    return data;
}