import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import wellknown from 'wellknown';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
import { anyQuery } from './queryFunctions.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(cors());

//Db config for cloud run/local
const dbConfig = {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: null,
  };

//Get rows from table with pagination, sorting, and filtering 
// @param table: string - The name of the table to get rows from
// @param page: number - The page number to get
// @param pageSize: number - The number of rows per page
// @param sortBy: string - The column to sort by
// @param sortDirection: string - The direction to sort by
// @param filters: object - The filters to apply to the query
// @returns: object - The rows from the table
app.get('/api/rows/:table/:page/:pageSize', async (req, res) => {
  try {
    const { table, page, pageSize } = req.params;
    const { sortBy, sortDirection, filters } = req.query;
    
    console.log('Request params:', {
      table,
      page,
      pageSize,
      sortBy,
      sortDirection,
      filters
    });

    if (!table || !page || !pageSize) {
      return res.status(400).json({ error: 'Table name, page, and page size are required' });
    }

    const pageNum = parseInt(page);
    const limit = parseInt(pageSize);
    const offset = (pageNum - 1) * limit;

    // Build the WHERE clause for filters
    let whereClause = '';
    const filterParams = [];
    if (filters) {
      try {
        const filterObj = JSON.parse(filters);
        console.log('Parsed filters:', filterObj);
        
        const conditions = Object.entries(filterObj)
          .filter(([_, value]) => value && value.trim() !== '')
          .map(([key, value]) => {
            filterParams.push(`%${value}%`);
            return `${key} LIKE '%${value}%'`;
          });
        
        if (conditions.length > 0) {
          whereClause = 'WHERE ' + conditions.join(' AND ');
        }
      } catch (error) {
        console.error('Error parsing filters:', error);
        return res.status(400).json({ error: 'Invalid filters format' });
      }
    }

    // Build the ORDER BY clause
    let orderByClause = '';
    if (sortBy) {
      // Sanitize sortBy to prevent SQL injection
      const sanitizedSortBy = sortBy.replace(/[^a-zA-Z0-9_]/g, '');
      const sanitizedDirection = sortDirection === 'desc' ? 'DESC' : 'ASC';
      orderByClause = `ORDER BY ${sanitizedSortBy} ${sanitizedDirection}`;
    }

    // Get total count for pagination
    const countQuery = `SELECT COUNT(*) as total FROM ${table} ${whereClause}`;
    
    // Get the actual data
    const dataQuery = `
      SELECT * FROM ${table} 
      ${whereClause} 
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    console.log('Generated queries:', {
      countQuery,
      dataQuery,
      filterParams,
      limit,
      offset
    });

    let totalCount, rows;
    
    if (process.env.ENV == "dev") {
      if (!dbConfig.database) {
        return res.status(400).json({ error: 'Database not selected' });
      }
      const connection = await mysql.createConnection(dbConfig);
      
      try {
        // Get total count
        [totalCount] = await connection.execute(countQuery, filterParams);
        
        // Get paginated data
        const queryParams = [...filterParams, limit, offset];
        console.log('Executing query with params:', {
          query: dataQuery,
          params: queryParams
        });
        
        [rows] = await connection.execute(dataQuery, queryParams);
      } finally {
        await connection.end();
      }
    } else {
      // Get total count
      [totalCount] = await anyQuery({
        tbl: countQuery,
        select: '*',
        params: filterParams
      });
      
      // Get paginated data
      [rows] = await anyQuery({
        tbl: dataQuery,
        select: '*',
        params: [...filterParams, limit, offset]
      });
    }
    
    if (!rows || rows.length == 0) {
      return res.status(404).json({ error: 'No data found' });
    }
    
    const response = {
      rows,
      totalCount: totalCount[0].total,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount[0].total / limit)
    };

    console.log('Sending response:', response);
    res.json(response);
  } catch (error) {
    console.error('Error fetching table data:', error);
    res.status(500).json({ error: 'Failed to fetch table data', details: error.message });
  }
});

//Get table names from database
// @param db: string - The name of the database to get table names from
// @returns: object - The table names from the database
app.get('/api/tableNames/:db', async (req, res) => {
  try {
    const { db } = req.params;
    console.log('Attempting to fetch tables for database:', db);
    
    if (!db) {
      return res.status(400).json({ error: 'Database name is required' });
    }

    // Set the database in the config
    dbConfig.database = db;
    console.log('Database config:', { ...dbConfig, password: '***' });

    let rows;
    if (process.env.ENV == "dev") {
      try {
        const connection = await mysql.createConnection(dbConfig);
        [rows] = await connection.execute('SHOW TABLES');
        await connection.end();
      } catch (dbError) {
        console.error('Database connection error:', dbError);
        return res.status(500).json({ 
          error: 'Failed to connect to database', 
          details: dbError.message 
        });
      }
    } else {
      try {
        [rows] = await anyQuery({
          tbl: 'SHOW TABLES',
          select: '*',
        });
      } catch (queryError) {
        console.error('Query execution error:', queryError);
        return res.status(500).json({ 
          error: 'Failed to execute query', 
          details: queryError.message 
        });
      }
    }

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No tables found in database' });
    }

    //console.log('Successfully fetched tables:', rows);
    res.json(rows);
  } catch (error) {
    console.error('Error in tableNames endpoint:', error);
    res.status(500).json({ 
      error: 'Failed to fetch table names', 
      details: error.message 
    });
  }
});

//Get databases from server
// @param none
// @returns: object - The databases from the server
app.get('/api/databases', async (req, res) => {
  try {
    let rows;
    if (process.env.ENV == "dev") {
      const connection = await mysql.createConnection(dbConfig);
      [rows] = await connection.execute('SHOW DATABASES');
      await connection.end();
    } else {
      [rows] = await anyQuery({
        tbl: 'SHOW DATABASES',
        select: '*',
      });
    }
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'No databases found' });
    }
    res.json(rows);
  } catch (error) {
    console.error('Error fetching databases:', error);
    res.status(500).json({ error: 'Failed to fetch databases', details: error.message });
  }
});

// Check if dist directory exists before trying to serve static files
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('Serving static files from dist directory');
  // Serve static files from the React app build directory
  app.use(express.static(distPath));

  // For any request that doesn't match an API route, send the React app
  app.get('/', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.log('Dist directory not found, serving API only.');
  app.get('/', (req, res) => {
    res.send('API server is running. Frontend build not available.');
  });
}

const PORT = process.env.PORT || 5051;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
