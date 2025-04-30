const axios = require("axios");
const { getIssuesByPhoneNumber } = require("../redmine.js"); // Replace with your module path

// Mock Axios for testing
jest.mock("axios");

describe("getIssuesByPhoneNumber", () => {
  it("should filter issues by phone number in description", async () => {
    // Mock data with issues containing phone numbers in descriptions
    const mockIssues = [
      { id: 1, description: "Issue with phone number 123-456-7890" },
      { id: 2, description: "Another issue with phone number (555) 123-4567" },
      { id: 3, description: "No phone number in this issue" },
    ];

    // Mock Axios GET response
    axios.get.mockResolvedValueOnce({ data: { issues: mockIssues } });

    // Define the phone number to search for
    const phoneNumber = "123";

    // Call the function
    const filteredIssues = await getIssuesByPhoneNumber(phoneNumber);

    // Assertions
    expect(filteredIssues).toHaveLength(2); // Expecting two issues containing '123' in description
    expect(filteredIssues[0].id).toEqual(1); // Verify the first issue's ID
    expect(filteredIssues[1].id).toEqual(2); // Verify the second issue's ID
  });

  it("should handle API errors", async () => {
    // Mock Axios GET error
    axios.get.mockRejectedValueOnce(new Error("API Error"));

    // Define the phone number to search for
    const phoneNumber = "123";

    // Call the function and expect it to throw an error
    await expect(getIssuesByPhoneNumber(phoneNumber)).rejects.toThrow(
      "API Error"
    );
  });
});
