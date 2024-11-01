// Function to generate a random integer within a range (inclusive)
const getRandomIntInRange = (min, max) =>
  Math.floor(Math.random() * (max - min + 1) + min);

// Function to get a random integer between 1 and 3
const getRandomType = () => Math.floor(Math.random() * 3) + 1;

/**
 * Generates mock location data within specified latitude and longitude bounds
 * @param {number} latMin - Minimum latitude
 * @param {number} latMax - Maximum latitude
 * @param {number} longMin - Minimum longitude
 * @param {number} longMax - Maximum longitude
 * @returns {Promise<Array>} Promise that resolves to array of location objects with integer coordinates
 */
export const generateMockLocations = async (
  latMin,
  latMax,
  longMin,
  longMax
) => {
  // Add 1 second delay
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const locations = [];

  for (let i = 0; i < 100; i++) {
    locations.push({
      latitude: getRandomIntInRange(latMin, latMax),
      longitude: getRandomIntInRange(longMin, longMax),
      type: getRandomType(),
    });
  }

  return locations;
};
