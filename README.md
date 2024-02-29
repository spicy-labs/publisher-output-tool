# Project Description
The Publisher Output Tool is a software tool created to test output of Publisher. It was made with the help of CHILI publish employees but is maintained by the community under the Spicy Labs organization.

You can get this tool from the [Releases](https://github.com/spicy-labs/publisher-output-tool/releases) page on its GitHub site. To use it, you write instructions in a file named `tests.json`, and the tool will tell you how long output took, and if there are any issues with the output.

This project is still being developed (WIP) and might never be feature complete, especially with focus being shifted towards GraFx Studio. Nonetheless, the creators hope that this tool will act as a way to facilitate communication within the CHILI community around output performance and stability.

<br/>

# Usage
1. **Get the Tool:** Download it from the [Releases](https://github.com/spicy-labs/publisher-output-tool/releases) page on GitHub for your computer, and store it in an appropiate location.
2. **Prepare Test Instructions:** Create a tests.json file in the same folder as the downloaded tool.
3. **Write Your Tests:** Fill in the `tests.json` file with the tests you want to run. See below for more details.
4. **Open Terminal or PowerShell:** Get ready to run the tool through the shell.
5. **Run the Tool:** Change directory (`cd`) to where the tool was downloaded, then start it by typing ./publisher-output-tool on Mac/Linux or ./publisher-output-tool.exe on Windows.

## JSON File
The `tests.json` file describes the tests that you wish to run.

The JSON file should be set up as follows:
```bash
{
    "tests": [
        {
            "name": string,
            "pdfExportSettingsId": string,
            "outputEachDocumentThisAmount": number,
            "randomizeOrder": boolean,
            "runAsync": boolean,
            "environment": {
                "name": string,
                "backofficeUrl": string,
                "auth": string || {"userName": string,  "password": string}
            },
            "documents": [
                {
                    "id": string,
                    "savedInEditor": boolean
                }
            ]
        }
    ]
}
```
The JSON consists of a list of **tests** at the top level, each item added to **tests** will designate a separate test to be run with a separate output file.

Each **test** object consists of the following properties:  
- **name**: The name you designate for the test. This is what the resulting output file will be called
- **pdfExportSettingsId**: The CHILI ID for the PDF expport settings you want to use for the tests
- **outputEachDocumentThisAmount**: The amount of outputs to run on each provided document
- **randomizeOrder**: `not implemented` Whether or not to randomize the order in which documents are output
- **runAsync**: Whether or not to run document outputs asynchronously; if set to `true`, then every document output task will be queued at once and won't wait for the previous task to resolve. Optional, will default to `false` if missing.
- **environment**: An object to hold the following CHILI environment information:
  -  **name**: The CHILI environment name (typically structured like "cp-abc-123")
  - **backofficeURL**: The base URL used to access the CHILI backoffice (i.e. *https://cp-abc-123.chili-publish.online/interface.aspx*)
  - **auth**: Provides authentication information. This can be supplied in two ways, either a live API key can be directly provided as a string, or an object can be provided with the following properties:
    - **userName**: A Publisher API User's username
    - **password**: A Publisher API User's password
- **documents**: A list of objects providing information on each document that you want to test that provides the following information:
  - **id**: The document's CHILI ID
  - **savedInEditor**: Sets the documents `savedInEditor` attribute to the boolean value provided

<br/>

# Build
If you'd prefer to make your own version of the tool, here's how you can do it.

## Requirements
- Node 21.x and latest NPM
- On Mac or Linux, you need to install Bun. See [Bun Install Docs](https://bun.sh/docs/installation) or just `npm install -g bun`.

Originally, the tool was built with [Node](https://nodejs.org) for all platforms, but due to issues with Mac and Linux builds, we switched to [Bun](https://bun.sh), which is easier to use. Once Bun supports Windows, all building processes will shift to Bun.

## Steps To Build

Before you start, make sure you have Node 21.x and the latest NPM installed. If you're on Mac or Linux, you'll also need Bun, which you can install from its website or by running npm install -g bun.

1. **Get the Code:** Clone the repository to your computer.
2. **Install Dependencies:** Run `npm install` to get the necessary packages.
3. **Build the Tool:** Execute `npm run build`, and you'll find the executable in the `./dist/` folder.

<br/>

# Contribution
Thank you for your interest in contributing to our project! As a community-driven initiative, we welcome contributions from individuals passionate about improving and extending the capabilities of our tool. Whether you're fixing a bug, adding a new feature, or improving documentation, your help is valuable. Here's how you can contribute:

## Ways to Contribute
1. **Bug Reports**: If you encounter a bug, please open an issue on our GitHub repository. Include a detailed description of the bug, steps to reproduce it, and any other relevant information that could help us fix it.

2. **Feature Suggestions**: Have an idea for a new feature? Share it with us by opening an issue. Describe the feature in detail, including how it should work and why it would be a beneficial addition to the project.

3. **Code Contributions**: Ready to dive into the code? Great! Here's how you can submit your code contributions:
   - **Fork the Repository**: Start by forking the project repository to your own GitHub account.
   - **Clone Your Fork**: Clone your fork to your local machine to start working on your contribution.
   - **Create a Branch**: For each new feature or fix, create a new branch in your fork. Name it something relevant to the contribution you're making.
   - **Make Your Changes**: Implement your feature or fix, adhering to the project's coding standards written in previous code.
   - **Commit Your Changes**: Commit your changes with a clear and descriptive commit message. If addressing an issue, include the issue number in your commit message.
   - **Push to Your Fork**: Push your changes to your fork on GitHub.
   - **Submit a Pull Request**: From your fork, submit a pull request to the main project repository. Provide a detailed description of your changes and reference any related issues.

4. **Documentation**: Help us improve our documentation, whether it's fixing typos, clarifying instructions, or adding new guides. Follow the same process as for code contributions, but focus your efforts on the `docs` directory.

## Before You Contribute
- Check the project's issues and pull requests to ensure your contribution isn't already being addressed.
- For significant changes, it's a good idea to open an issue first to discuss it with the project maintainers.

## Pull Request Review Process
Once you submit a pull request, the project maintainers will review your changes. This project is being ran as a side project, thus response times can vary depending on the complexity of the contribution and the availability of the maintainers.

If revisions are necessary, we'll provide feedback to guide you. Once your pull request meets all requirements, a project maintainer will merge it into the project.

## Join the Community
We encourage contributors to engage with the project and its community:
- **Follow Development**: Keep an eye on the project's GitHub repository to stay updated on progress and discussions.
- **Join Discussions**: Participate in discussions on issues and pull requests. Your insights and feedback can help shape the project.

Thank you for considering contributing to our project. Your efforts help us build a better tool for everyone!
