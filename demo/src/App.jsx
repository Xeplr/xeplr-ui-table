import { useState } from 'react'
import { XeplrTable } from 'xeplr-ui-table'

var initialData = [
  {
    id: '1', name: 'Engineering', budget: 500000, status: 'active',
    employees: [
      { id: 'e1', name: 'Alice Johnson', role: 'Lead', salary: 120000 },
      { id: 'e2', name: 'Bob Smith', role: 'Senior', salary: 105000 },
      { id: 'e3', name: 'Charlie Brown', role: 'Junior', salary: 70000 }
    ]
  },
  {
    id: '2', name: 'Marketing', budget: 300000, status: 'active',
    employees: [
      { id: 'e4', name: 'Diana Prince', role: 'Lead', salary: 115000 },
      { id: 'e5', name: 'Eve Wilson', role: 'Senior', salary: 95000 }
    ]
  },
  {
    id: '3', name: 'Sales', budget: 400000, status: 'active',
    employees: [
      { id: 'e6', name: 'Frank Castle', role: 'Lead', salary: 110000 },
      { id: 'e7', name: 'Grace Hopper', role: 'Senior', salary: 100000 },
      { id: 'e8', name: 'Hank Pym', role: 'Junior', salary: 65000 },
      { id: 'e9', name: 'Ivy Chen', role: 'Junior', salary: 68000 }
    ]
  },
  {
    id: '4', name: 'Management', budget: 250000, status: 'inactive',
    employees: [
      { id: 'e10', name: 'Jack Reacher', role: 'Director', salary: 150000 }
    ]
  }
]

var schema = {
  0: {
    key: 'department',
    columns: [
      { accessor: 'id', header: 'ID' },
      { accessor: 'name', header: 'Department' },
      { accessor: 'budget', header: 'Budget', dataType: 'number',
        cellStyle: [
          { when: "$.budget >= 400000", backgroundColor: '#1b5e20', color: '#a5d6a7' },
          { when: "$.budget < 300000",  backgroundColor: '#bf360c', color: '#ffab91' }
        ]
      },
      { accessor: 'status', header: 'Status',
        cellStyle: [
          { when: "$.status is active",   backgroundColor: '#1b5e20', color: '#a5d6a7' },
          { when: "$.status is inactive", backgroundColor: '#b71c1c', color: '#ef9a9a' }
        ]
      }
    ]
  },
  1: {
    key: 'employees',
    header: 'Employees',
    columns: [
      { accessor: 'id', header: 'ID' },
      { accessor: 'name', header: 'Name' },
      { accessor: 'role', header: 'Role',
        cellStyle: [
          { when: "$.role is Lead", fontWeight: 'bold', color: '#ffd700' },
          { when: "$.role is Director", fontWeight: 'bold', color: '#ff9800' }
        ]
      },
      { accessor: 'salary', header: 'Salary', dataType: 'number',
        cellStyle: [
          { when: "$.salary >= 100000", backgroundColor: '#1b5e20', color: '#a5d6a7' },
          { when: "$.salary < 70000",   backgroundColor: '#bf360c', color: '#ffab91' }
        ]
      }
    ]
  }
}

function App() {
  var [data, setData] = useState(initialData)
  var [log, setLog] = useState([])
  var [childDisplay, setChildDisplay] = useState('popup')

  function addLog(msg) {
    setLog(function(prev) { return [msg].concat(prev).slice(0, 50) })
  }

  async function handleCommit(changeSet) {
    addLog('--- COMMIT ---')
    addLog(JSON.stringify(changeSet, null, 2))
    await new Promise(function(r) { setTimeout(r, 500) })
    addLog('--- committed successfully ---')
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: 22, color: '#e0e0e0' }}>xeplr-ui-table demo</h1>
      <p style={{ margin: '0 0 12px', fontSize: 13, color: '#666' }}>
        Schema-driven, parent/child, transactional queue, deep diff changeset
      </p>
      <div style={{ marginBottom: 16, fontSize: 13 }}>
        <label style={{ color: '#a0a0c0', marginRight: 8 }}>Child display:</label>
        <button
          style={{ padding: '3px 10px', marginRight: 4, border: '1px solid #3a3a5a', borderRadius: 4, background: childDisplay === 'popup' ? '#3a3a6a' : 'transparent', color: childDisplay === 'popup' ? '#7c7cff' : '#666', cursor: 'pointer' }}
          onClick={function() { setChildDisplay('popup') }}>
          Popup
        </button>
        <button
          style={{ padding: '3px 10px', border: '1px solid #3a3a5a', borderRadius: 4, background: childDisplay === 'inner' ? '#3a3a6a' : 'transparent', color: childDisplay === 'inner' ? '#7c7cff' : '#666', cursor: 'pointer' }}
          onClick={function() { setChildDisplay('inner') }}>
          Inner
        </button>
      </div>

      <XeplrTable
        data={data}
        schema={schema}
        childDisplay={childDisplay}
        pageSize={10}
        onCommit={handleCommit}
      />

      <div style={{
        marginTop: 20, padding: '12px 16px', background: '#141428',
        border: '1px solid #2a2a4a', borderRadius: 8, fontSize: 12,
        color: '#888', maxHeight: 300, overflow: 'auto'
      }}>
        <strong style={{ color: '#a0a0c0' }}>API Log (changeSet)</strong>
        {log.length === 0 && <div style={{ marginTop: 6 }}>Make changes and hit Commit.</div>}
        {log.map(function(entry, i) {
          return <pre key={i} style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 11, whiteSpace: 'pre-wrap' }}>{entry}</pre>
        })}
      </div>
    </div>
  )
}

export default App
