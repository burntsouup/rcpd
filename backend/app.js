const express = require('express');
const { ClientSecretCredential } = require('@azure/identity');
const sql = require('mssql');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('frontend'));

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

// API endpoint: Search for doctors
app.get('/api/doctors', async (req, res) => {
    const { search } = req.query;
    
    if (!search) {
      return res.status(400).json({ error: 'Please provide a search parameter.' });
    }
    
    try {
      // Get the access token
      const accessToken = await getAccessToken();
      console.log('Access Token acquired.');
      
      // Configure connection for mssql using the access token
      const config = {
        server: sqlServer,
        database: database,
        options: {
          encrypt: true,
        },
        authentication: {
          type: 'azure-active-directory-access-token',
          options: {
            token: accessToken,
          },
        },
      };
  
      // Connect to the database
      const pool = await sql.connect(config);
  
      // Query the database for doctors matching the search
      const query = `
        SELECT * FROM Doctors
        WHERE name LIKE @search 
          OR Specialty LIKE @search 
          OR Clinic_Name LIKE @search 
          OR City LIKE @search 
          OR State_Province LIKE @search 
          OR Country LIKE @search 
          OR Postal_Zip_Code LIKE @search
      `;
      const result = await pool.request()
        .input('search', sql.VarChar, `%${search}%`)
        .query(query);
  
      // Close the connection
      await pool.close();
  
      // Return the results as JSON
      res.json(result.recordset);
    } catch (error) {
      console.error('Error querying doctors:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
  
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

app.get('*', (req, res) => {
  res.status(404).send('Not Found');
});
