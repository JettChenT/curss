import './App.css'
import { useAllUsers } from '@/lib/hooks/use-all-users'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { useSearchUsers } from '@/lib/hooks/use-search-users'

function App() {
  const [search, setSearch] = useState('');
  const { results, isLoading, isError, error, total } = useSearchUsers(search);
  return (
    <div>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} />
      {isLoading && <p>Loading...</p>}
      {isError && <p>Error: {error instanceof Error ? error.message : 'Unknown error'}</p>}
      {results.map((user) => (
        <div key={user.id}>{user.firstName} {user.lastName}</div>
      ))}
    </div>
  )
}

export default App
