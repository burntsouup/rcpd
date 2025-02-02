const { ClientSecretCredential } = require('@azure/identity');
const sql = require('mssql');

const tenantId = '0c79a9aa-feb7-4296-911f-1db2fdf1afc8';
const clientId = '4bf9358f-f159-4db4-85a0-95377c397218';
const clientSecret = 'mzh8Q~HyGF3JSi4a94rmuP3k7aS50SKuE~DlmaTb';
const sqlServer = 'dbserver-rcpd-canadacentral-001.database.windows.net'; // e.g., myserver.database.windows.net
const database = 'db-rcpd-canadacentral-001';

// Create the credential object
const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);

// Function to get an access token for Azure SQL Database
async function getAccessToken() {
  // The scope for Azure SQL Database tokens is always "https://database.windows.net//.default"
  const scope = "https://database.windows.net//.default";
  const tokenResponse = await credential.getToken(scope);
  return tokenResponse.token;
}

// Main function to connect to the database and run a query
async function queryDatabase() {
  try {
    const accessToken = await getAccessToken();
    console.log('Access Token acquired.');

    // Configure the connection options for mssql
    const config = {
      server: sqlServer,
      database: database,
      options: {
        encrypt: true, // Required for Azure SQL Database
      },
      // Instead of user/password, pass the access token
      authentication: {
        type: 'azure-active-directory-access-token',
        options: {
          token: accessToken,
        },
      },
    };

    // Connect to the database
    let pool = await sql.connect(config);
    console.log('Connected to Azure SQL Database.');

    // Run a sample query
    let result = await pool.request().query('SELECT TOP 10 * FROM Doctors');
    console.log('Query results:', result.recordset);

    // Close the connection pool
    await pool.close();
  } catch (err) {
    console.error('Error querying database:', err);
  }
}

// Run the main function
queryDatabase();


