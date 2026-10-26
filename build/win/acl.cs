// FD-94: the token file's access list for the app's token check (packages/service-host/src/health.ts), the same JSON
// as its ACL_SCRIPT prints, without starting Windows PowerShell: one argument, the file; stdout
// {"user": SID, "owner": SID, "aces": [{"sid", "type", "mask"}]}; exit 1 with the reason on stderr. Built by
// scripts/dist-other.mjs with the .NET Framework compiler every Windows has, and signed with the app.
using System;
using System.IO;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;

static class Acl
{
    static int Main(string[] args)
    {
        if (args.Length != 1)
        {
            Console.Error.WriteLine("usage: fabric-dashboards-acl <file>");
            return 2;
        }
        try
        {
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
