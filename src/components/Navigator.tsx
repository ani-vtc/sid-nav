import { useEffect, useState } from 'react';

const Navigator = () => {
    const [databases, setDatabases] = useState<string[]>([]);
    const [selectedDb, setSelectedDb] = useState<string | null>(null);
    const [tables, setTables] = useState<string[]>([]);
    const [debounceTimeout, setDebounceTimeout] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);
    const [openTable, setOpenTable] = useState<string | null>(null);
    const [tableRows, setTableRows] = useState<any[]>([]);
    const [tableColumns, setTableColumns] = useState<string[]>([]);
    const [rowsLoading, setRowsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [filters, setFilters] = useState<{ [key: string]: string }>({});
    const [totalRows, setTotalRows] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const rowsPerPage = 20;

    // Fetch databases on mount
    // @param: none
    // @returns: none
    useEffect(() => {
        const fetchDatabases = async () => {
            try {
                const res = await fetch(window.location.hostname === "localhost" ? "http://localhost:5050/api/databases" : "/api/databases");
                const data = await res.json();
                const dbNames = data.map((row: any) => Object.values(row)[0]);
                setDatabases(dbNames);
                if (dbNames.length > 0) setSelectedDb(dbNames[0]);
            } catch (error) {
                console.error('Error fetching databases:', error);
            }
        };
        fetchDatabases();
    }, []);

    // Fetch tables when selectedDb changes
    // @param: none
    // @returns: none
    useEffect(() => {
        if (!selectedDb) return;
        try {
            setLoading(true);
            fetch(window.location.hostname === "localhost" ? `http://localhost:5050/api/tableNames/${selectedDb}` : `/api/tableNames/${selectedDb}`)
                .then(res => res.json())
                .then(data => {
                    const tableNames = data.map((row: any) => Object.values(row)[0]);
                    setTables(tableNames);
                    setLoading(false);
                });
        } catch (error) {
            console.error('Error fetching table names:', error);
            setLoading(false);
        }
    }, [selectedDb]);

    // Fetch table data
    // @param: table: string - The name of the table to fetch data from
    // @param: page: number - The page number to fetch
    // @param: sortBy: string - The column to sort by
    // @param: sortDirection: string - The direction to sort by
    // @returns: none
    const fetchTableData = async (table: string, page: number, sortBy?: string, sortDirection?: string) => {
        setRowsLoading(true);
        try {
            // Only include non-empty filters
            const activeFilters = Object.entries(filters)
                .filter(([_, value]) => value.trim() !== '')
                .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

            // Build the URL with path parameters
            const baseUrl = window.location.hostname === "localhost" 
                ? `http://localhost:5050/api/rows/${table}/${page}/${rowsPerPage}`
                : `/api/rows/${table}/${page}/${rowsPerPage}`;

            // Build query parameters
            const queryParams = new URLSearchParams();
            if (sortBy) {
                queryParams.append('sortBy', sortBy);
                queryParams.append('sortDirection', sortDirection || 'asc');
            }
            if (Object.keys(activeFilters).length > 0) {
                queryParams.append('filters', JSON.stringify(activeFilters));
            }

            // Construct final URL
            const url = queryParams.toString() 
                ? `${baseUrl}?${queryParams.toString()}`
                : baseUrl;

            console.log('Fetching URL:', url); // Debug log

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('Received data:', data); // Debug log
            
            setTableRows(data.rows || []);
            if (data.rows && data.rows.length > 0) {
                setTableColumns(Object.keys(data.rows[0]));
                setTotalRows(data.totalCount || 0);
                setTotalPages(data.totalPages || 0);
            } else {
                //setTableColumns([]);
                setTotalRows(0);
                setTotalPages(0);
            }
            
        } catch (error) {
            console.error('Error fetching table data:', error);
            setTableRows([]);
            //setTableColumns([]);
            setTotalRows(0);
            setTotalPages(0);
        } finally {
            setRowsLoading(false);
        }
    };

    // Handle table click
    // @param: table: string - The name of the table to fetch data from
    // @returns: none
    const handleTableClick = (table: string) => {
        if (openTable === table) {
            setOpenTable(null);
            setTableRows([]);
            setTableColumns([]);
            setCurrentPage(1);
            setSortConfig(null);
            setFilters({});
        } else {
            setOpenTable(table);
            setCurrentPage(1);
            setSortConfig(null);
            setFilters({});
            fetchTableData(table, 1);
        }
    };

    // Handle sort
    // @param: key: string - The column to sort by
    // @returns: none
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
        if (openTable) {
            fetchTableData(openTable, currentPage, key, direction);
        }
    };

    // Handle filter change
    // @param: key: string - The column to filter by
    // @param: value: string - The value to filter by
    // @returns: none
    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));

        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        const timeout = setTimeout(() => {
            setCurrentPage(1);
            if (openTable) {
                fetchTableData(openTable, 1, sortConfig?.key, sortConfig?.direction);
            }
        }, 300);

        setDebounceTimeout(timeout);
    };

    // Handle page change
    // @param: newPage: number - The new page number
    // @returns: none
    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage);
        if (openTable) {
            fetchTableData(openTable, newPage, sortConfig?.key, sortConfig?.direction);
        }
    };

    return (
        <div>
            <h1>Navigator</h1>
            <div style={{ marginBottom: '1rem' }}>
                <label htmlFor="db-select">Select Database: </label>
                <select
                    id="db-select"
                    value={selectedDb || ''}
                    onChange={e => setSelectedDb(e.target.value)}
                    disabled={databases.length === 0}
                >
                    {databases.map(db => (
                        <option key={db} value={db}>{db}</option>
                    ))}
                </select>
            </div>
            {loading ? (
                <div>Loading tables...</div>
            ) : (
                <div>
                    {tables.map(table => (
                        <div key={table} style={{ marginBottom: '0.5rem', border: '1px solid #222', borderRadius: 4, overflow: 'hidden' }}>
                            <div
                                style={{ fontSize: '1.2rem', background: '#222', color: 'white', padding: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                onClick={() => handleTableClick(table)}
                            >
                                {table} {openTable !== table ? '▶' : '▼'}
                            </div>
                            {openTable === table && (
                                <div style={{ padding: '1rem', background: '#f4f4f4' }}>
                                    <table style={{ color: '#222', width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                                        <thead>
                                            <tr>
                                                {tableColumns.map(col => (
                                                    <th key={col} style={{ border: '1px solid #ccc', padding: '0.25rem', background: '#eee' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            <div 
                                                                style={{ cursor: 'pointer' }}
                                                                onClick={() => handleSort(col)}
                                                            >
                                                                {col} {sortConfig?.key === col && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder={`Filter ${col}`}
                                                                value={filters[col] || ''}
                                                                onChange={(e) => handleFilterChange(col, e.target.value)}
                                                                style={{ width: '100%', padding: '0.25rem' }}
                                                            />
                                                        </div>
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rowsLoading ? (
                                                // Show empty rows during loading
                                                Array(rowsPerPage).fill(null).map((_, idx) => (
                                                    <tr key={`loading-${idx}`}>
                                                        {tableColumns.map(col => (
                                                            <td key={col} style={{ border: '1px solid #ccc', padding: '0.25rem' }}>
                                                                {/* Empty cell during loading */}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))
                                            ) : (
                                                tableRows.map((row, idx) => (
                                                    <tr key={idx}>
                                                        {tableColumns.length > 0 ? tableColumns.map(col => (
                                                            <td key={col} style={{ border: '1px solid #ccc', padding: '0.25rem' }}>
                                                                {String(row[col] ?? '')}
                                                            </td>
                                                        )) : (
                                                            <td colSpan={tableColumns.length} style={{ border: '1px solid #ccc', padding: '0.25rem' }}>
                                                                No data available
                                                            </td>
                                                        )}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                    <div style={{color: '#222', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                                        <div    >
                                            {rowsLoading ? (
                                                'Loading...'
                                            ) : (
                                                `Showing ${((currentPage - 1) * rowsPerPage) + 1} to ${Math.min(currentPage * rowsPerPage, totalRows)} of ${totalRows} rows`
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={() => handlePageChange(currentPage - 1)}
                                                disabled={currentPage === 1 || rowsLoading}
                                                style={{ padding: '0.5rem 1rem', cursor: (currentPage === 1 || rowsLoading) ? 'not-allowed' : 'pointer' }}
                                            >
                                                Previous
                                            </button>
                                            <span style={{ padding: '0.5rem' }}>
                                                Page {currentPage} of {totalPages}
                                            </span>
                                            <button
                                                onClick={() => handlePageChange(currentPage + 1)}
                                                disabled={currentPage === totalPages || rowsLoading}
                                                style={{ padding: '0.5rem 1rem', cursor: (currentPage === totalPages || rowsLoading) ? 'not-allowed' : 'pointer' }}
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default Navigator;
