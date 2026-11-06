// FD-94: the token file's access list for the app's token check (packages/service-host/src/health.ts), the same JSON
// as its ACL_SCRIPT prints, without starting Windows PowerShell: one argument, the file; stdout
// {"user": SID, "owner": SID, "aces": [{"sid", "type", "mask"}]}; exit 1 with the reason on stderr. Built by
// scripts/dist-other.mjs with the .NET Framework compiler every Windows has, and signed with the app.
// FD-159 (DEC-0154 HA-2): `--listeners` prints {"user": SID, "listeners": [{"port", "pid", "sid"}]}, every IPv4 TCP
// listener a connection to 127.0.0.1 reaches (on 127.0.0.1 or 0.0.0.0), from GetExtendedTcpTable, with its process's
// token user; "sid" is null when the process or its token cannot be opened (another user's, or a system process).
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;

static class Acl
{
    [DllImport("iphlpapi.dll", SetLastError = true)]
    static extern uint GetExtendedTcpTable(IntPtr table, ref int size, bool sort, int family, int tableClass, uint reserved);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)]
    static extern bool GetTokenInformation(IntPtr token, int infoClass, IntPtr info, int length, out int returned);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);

    const int AF_INET = 2, TCP_TABLE_OWNER_PID_LISTENER = 3, TOKEN_USER = 1;
    const uint PROCESS_QUERY_LIMITED_INFORMATION = 0x1000, TOKEN_QUERY = 0x0008, NO_ERROR = 0, ERROR_INSUFFICIENT_BUFFER = 122;

    /** The SID of the user a process runs as, or null when its process or token cannot be opened. */
    static string OwnerOf(uint pid)
    {
        IntPtr process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid);
        if (process == IntPtr.Zero) return null;
        IntPtr token = IntPtr.Zero, info = IntPtr.Zero;
        try
        {
            if (!OpenProcessToken(process, TOKEN_QUERY, out token)) return null;
            int length;
            GetTokenInformation(token, TOKEN_USER, IntPtr.Zero, 0, out length);
            if (length <= 0) return null;
            info = Marshal.AllocHGlobal(length);
            if (!GetTokenInformation(token, TOKEN_USER, info, length, out length)) return null;
            return new SecurityIdentifier(Marshal.ReadIntPtr(info)).Value;
        }
        finally
        {
            if (info != IntPtr.Zero) Marshal.FreeHGlobal(info);
            if (token != IntPtr.Zero) CloseHandle(token);
            CloseHandle(process);
        }
    }

    static int Listeners()
    {
        int size = 0;
        uint r = GetExtendedTcpTable(IntPtr.Zero, ref size, false, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0);
        IntPtr table = IntPtr.Zero;
        try
        {
            // The table may grow between the size query and the read: ask again with the size it names.
            for (int i = 0; i < 4 && (r == ERROR_INSUFFICIENT_BUFFER || table == IntPtr.Zero); i++)
            {
                if (table != IntPtr.Zero) Marshal.FreeHGlobal(table);
                table = Marshal.AllocHGlobal(size);
                r = GetExtendedTcpTable(table, ref size, false, AF_INET, TCP_TABLE_OWNER_PID_LISTENER, 0);
            }
            if (r != NO_ERROR) throw new Exception("GetExtendedTcpTable failed: " + r);
            int count = Marshal.ReadInt32(table);
            var json = new StringBuilder();
            json.Append("{\"user\":\"").Append(WindowsIdentity.GetCurrent().User.Value).Append("\",\"listeners\":[");
            var first = true;
            for (int i = 0; i < count; i++)
            {
                // MIB_TCPROW_OWNER_PID: state, localAddr, localPort, remoteAddr, remotePort, owningPid (six DWORDs).
                IntPtr row = IntPtr.Add(table, 4 + i * 24);
                uint addr = (uint)Marshal.ReadInt32(row, 4);
                uint port = (uint)Marshal.ReadInt32(row, 8);
                uint pid = (uint)Marshal.ReadInt32(row, 20);
                if (addr != 0 && addr != 0x0100007F) continue; // 0.0.0.0 or 127.0.0.1, in network byte order
                port = ((port & 0xFF) << 8) | ((port >> 8) & 0xFF);
                string sid = OwnerOf(pid);
                if (!first) json.Append(',');
                first = false;
                json.Append("{\"port\":").Append(port).Append(",\"pid\":").Append(pid).Append(",\"sid\":");
                json.Append(sid == null ? "null" : "\"" + sid + "\"").Append('}');
            }
            Console.Out.Write(json.Append("]}").ToString());
            return 0;
        }
        finally
        {
            if (table != IntPtr.Zero) Marshal.FreeHGlobal(table);
        }
    }

    static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("usage: fabric-dashboards-acl <file> | --listeners");
            return 2;
        }
        try
        {
            if (args[0] == "--listeners") return Listeners();
            var sec = File.GetAccessControl(args[0]);
            var json = new StringBuilder();
            // SIDs and AccessControlType names hold no character JSON escapes.
            json.Append("{\"user\":\"").Append(WindowsIdentity.GetCurrent().User.Value);
            json.Append("\",\"owner\":\"").Append(sec.GetOwner(typeof(SecurityIdentifier)).Value).Append("\",\"aces\":[");
            var first = true;
            foreach (FileSystemAccessRule r in sec.GetAccessRules(true, true, typeof(SecurityIdentifier)))
            {
                if (!first) json.Append(',');
                first = false;
                json.Append("{\"sid\":\"").Append(r.IdentityReference.Value).Append("\",\"type\":\"").Append(r.AccessControlType);
                json.Append("\",\"mask\":").Append(((long)(int)r.FileSystemRights) & 0xFFFFFFFFL).Append('}');
            }
            Console.Out.Write(json.Append("]}").ToString());
            return 0;
        }
        catch (Exception e)
        {
            Console.Error.WriteLine(e.Message);
            return 1;
        }
    }
}
