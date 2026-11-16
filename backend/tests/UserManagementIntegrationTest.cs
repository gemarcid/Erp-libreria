using System;
using System.IO;
using System.Net;
using System.Text;
using System.Xml;
using System.Collections.Generic;
using MySql.Data.MySqlClient;
using Newtonsoft.Json.Linq;
using backend.Models;

// Uses only newly created test accounts, and removes them in finally.
class UserManagementIntegrationTest
{
    static string prefix = "codex-users-" + Guid.NewGuid().ToString("N");
    static List<int> testIds = new List<int>();
    static List<int> customerIds = new List<int>();
    static int checks;
    static string password = "Test-account-123!";
    static CookieContainer frontendCookies = new CookieContainer();
    static string Form(params string[] fields) {
        var parts = new List<string>();
        for (int i=0;i<fields.Length;i+=2) parts.Add(Uri.EscapeDataString(fields[i])+"="+Uri.EscapeDataString(fields[i+1]));
        return string.Join("&", parts);
    }
    static JToken Call(string path, int expected, string token=null, string form=null) {
        var request = (HttpWebRequest)WebRequest.Create("http://localhost:5000"+path);
        request.Timeout=45000;
        if(token!=null) request.Headers["Authorization"]="Bearer "+token;
        if(form!=null) {
            request.Method="POST"; request.ContentType="application/x-www-form-urlencoded";
            var bytes=Encoding.UTF8.GetBytes(form); request.ContentLength=bytes.Length;
            using(var stream=request.GetRequestStream()) stream.Write(bytes,0,bytes.Length);
        }
        HttpWebResponse response;
        try { response=(HttpWebResponse)request.GetResponse(); }
        catch(WebException ex) { response=ex.Response as HttpWebResponse; if(response==null) throw; }
        using(response) using(var reader=new StreamReader(response.GetResponseStream())) {
            var text=reader.ReadToEnd();
            if((int)response.StatusCode!=expected) throw new Exception(path+": expected "+expected+", got "+(int)response.StatusCode+" "+text.Substring(0,Math.Min(text.Length,200)));
            checks++; return JToken.Parse(text);
        }
    }
    static object Scalar(MySqlConnection c,string sql,params object[] args) {
        using(var cmd=new MySqlCommand(sql,c)) { for(int i=0;i<args.Length;i++) cmd.Parameters.AddWithValue("@p"+i,args[i]); return cmd.ExecuteScalar(); }
    }
    static JToken Frontend(string path, int expected, JObject body=null) {
        var request=(HttpWebRequest)WebRequest.Create("http://localhost:3000"+path);
        request.Timeout=45000; request.CookieContainer=frontendCookies;
        if(body!=null) {
            request.Method="POST"; request.ContentType="application/json"; request.Headers["Origin"]="http://localhost:3000";
            var bytes=Encoding.UTF8.GetBytes(body.ToString()); request.ContentLength=bytes.Length;
            using(var stream=request.GetRequestStream()) stream.Write(bytes,0,bytes.Length);
        }
        HttpWebResponse response;
        try { response=(HttpWebResponse)request.GetResponse(); }
        catch(WebException ex) { response=ex.Response as HttpWebResponse; if(response==null) throw; }
        using(response) using(var reader=new StreamReader(response.GetResponseStream())) {
            var text=reader.ReadToEnd();
            if((int)response.StatusCode!=expected) throw new Exception(path+": expected "+expected+", got "+(int)response.StatusCode+" "+text.Substring(0,Math.Min(text.Length,200)));
            checks++; return JToken.Parse(text);
        }
    }
    static string Rut(int number) {
        string body=number.ToString(); int sum=0,factor=2;
        for(int i=body.Length-1;i>=0;i--) { sum+=(body[i]-'0')*factor; factor=factor==7?2:factor+1; }
        int digit=11-sum%11; return body+"-"+(digit==11?"0":digit==10?"K":digit.ToString());
    }
    static string Login(string email) { return (string)Call("/Login/Ingresar",200,null,Form("email",email,"password",password))["sessionToken"]; }
    static int Main(string[] args) {
        var root=Path.GetFullPath(args[0]); var config=new XmlDocument(); config.Load(Path.Combine(root,"ConnectionStrings.config"));
        var builder=new MySqlConnectionStringBuilder(config.SelectSingleNode("/connectionStrings/add[@name='ConexionMySQL']").Attributes["connectionString"].Value) { ConnectionTimeout=5 };
        bool migrate=args.Length>1 && args[1]=="--migrate";
        if(migrate) builder.AllowUserVariables=true;
        using(var c=new MySqlConnection(builder.ConnectionString)) {
            c.Open();
            if(migrate) {
                using(var cmd=new MySqlCommand(File.ReadAllText(Path.Combine(root,"..","MySql","migrations","20261008_cliente_role.sql")),c)) cmd.ExecuteNonQuery();
                using(var cmd=new MySqlCommand(File.ReadAllText(Path.Combine(root,"..","MySql","migrations","20261008_usuario_cliente.sql")),c)) cmd.ExecuteNonQuery();
                Console.WriteLine("PASS: perfil Cliente y vínculo con Ventas configurados."); return 0;
            }
            int adminRole=Convert.ToInt32(Scalar(c,"SELECT id_rol FROM ROL WHERE LOWER(nombre) IN ('administrador','admin','administradora') ORDER BY id_rol LIMIT 1"));
            int clientRole=Convert.ToInt32(Scalar(c,"SELECT id_rol FROM ROL WHERE LOWER(nombre)='cliente' ORDER BY id_rol LIMIT 1"));
            int vendorRole=Convert.ToInt32(Scalar(c,"SELECT id_rol FROM ROL WHERE LOWER(nombre) IN ('vendedor','vendedora') ORDER BY id_rol LIMIT 1"));
            string adminEmail=prefix+"-admin@example.invalid", customerEmail=prefix+"-customer@example.invalid", staffEmail=prefix+"-staff@example.invalid";
            string rut=Rut(80000000+new Random().Next(9000000));
            try {
                using(var tx=c.BeginTransaction()) {
                    testIds.Add(UserAccounts.Create(c,tx,"Test administrador",adminEmail,password,adminRole,"activo"));
                    tx.Commit();
                }
                var admin=Login(adminEmail);
                Call("/Administracion/Listar",401);
                Call("/Login/Registrar",400,null,Form("nombre","Test","email",customerEmail,"password",password,"rut","12345678-9","tipoCliente","persona"));
                Call("/Login/Registrar",201,null,Form("nombre","Test cliente","email",customerEmail,"password",password,"rut",rut,"tipoCliente","persona","idRol",adminRole.ToString()));
                int customerUser=Convert.ToInt32(Scalar(c,"SELECT id_usuario FROM USUARIO WHERE correo=@p0",customerEmail)); testIds.Add(customerUser);
                int customerId=Convert.ToInt32(Scalar(c,"SELECT id_cliente FROM USUARIO WHERE id_usuario=@p0",customerUser)); customerIds.Add(customerId);
                if(Convert.ToInt32(Scalar(c,"SELECT id_rol FROM USUARIO WHERE id_usuario=@p0",customerUser))!=clientRole) throw new Exception("Registration allowed role escalation");
                if(Convert.ToString(Scalar(c,"SELECT rut FROM CLIENTE WHERE id_cliente=@p0",customerId))!=rut) throw new Exception("Missing customer link");
                Call("/Login/Registrar",409,null,Form("nombre","Duplicado","email",customerEmail,"password",password,"rut",rut,"tipoCliente","persona"));
                var client=Login(customerEmail);
                foreach(var endpoint in new[]{"/Administracion/Listar","/Dashboard/Resumen","/Inventario/ListarInventario","/Contabilidad/Diario","/api/libros","/api/proveedores","/api/ordenes-compra","/api/recepciones/pendientes","/Ventas/Clientes","/Ventas/Libros","/Ventas/ReporteClientes"})
                    Call(endpoint,403,client);
                var catalog=Call("/Cliente/Catalogo",200,client) as JArray;
                foreach(JObject book in catalog) if(book["stock"]!=null || book["costo_unitario"]!=null) throw new Exception("Internal data in customer catalog");
                var profile=Call("/Cliente/Perfil?id="+testIds[0],200,client);
                if((string)profile["correo"]!=customerEmail) throw new Exception("Profile isolation failed");
                Call("/Cliente/GuardarPerfil",400,client,Form("nombre","Test cliente","correo",customerEmail,"passwordActual","wrong-password","tipoCliente","persona"));
                Call("/Cliente/GuardarPerfil",200,client,Form("nombre","Test cliente editado","correo",customerEmail,"passwordActual",password,"tipoCliente","empresa","idRol",adminRole.ToString(),"id",testIds[0].ToString()));
                if(Convert.ToString(Scalar(c,"SELECT nombre FROM CLIENTE WHERE id_cliente=@p0",customerId))!="Test cliente editado") throw new Exception("Sales profile was not updated");
                if(Convert.ToString(Scalar(c,"SELECT tipo_cliente FROM CLIENTE WHERE id_cliente=@p0",customerId))!="persona") throw new Exception("Customer changed their own type");
                Call("/Administracion/Guardar",200,admin,Form("id",customerUser.ToString(),"nombre","Test cliente editado","correo",customerEmail,"idRol",clientRole.ToString(),"estado","activo","rut",rut,"tipoCliente","empresa"));
                if(Convert.ToString(Scalar(c,"SELECT tipo_cliente FROM CLIENTE WHERE id_cliente=@p0",customerId))!="empresa") throw new Exception("Administrator could not change customer type");
                Call("/Administracion/Guardar",403,client,Form("nombre","Test","correo",staffEmail,"password",password,"idRol",adminRole.ToString(),"estado","activo"));
                var created=Call("/Administracion/Guardar",200,admin,Form("nombre","Test vendedor","correo",staffEmail,"password",password,"idRol",vendorRole.ToString(),"estado","activo"));
                int staffId=(int)created["id"]; testIds.Add(staffId);
                var staff=Login(staffEmail);
                var sales=Call("/Ventas/Clientes?buscar="+Uri.EscapeDataString(rut),200,staff);
                if(((JArray)sales["clientes"]).Count!=1) throw new Exception("Registered customer is unavailable to Sales");
                Call("/Administracion/Guardar",200,admin,Form("id",staffId.ToString(),"nombre","Test vendedor editado","correo",staffEmail,"idRol",vendorRole.ToString(),"estado","inactivo"));
                Call("/Login/Sesion",401,staff);
                Call("/Login/Ingresar",401,null,Form("email",staffEmail,"password",password));
                Call("/Administracion/Guardar",200,admin,Form("id",staffId.ToString(),"nombre","Test vendedor editado","correo",staffEmail,"idRol",vendorRole.ToString(),"estado","activo"));
                Call("/Administracion/Guardar",400,admin,Form("id",testIds[0].ToString(),"nombre","Test administrador","correo",adminEmail,"idRol",vendorRole.ToString(),"estado","activo"));
                var listing=Call("/Administracion/Listar",200,admin);
                foreach(JObject user in (JArray)listing["usuarios"]) if(user["password_hash"]!=null) throw new Exception("Password hash exposed");
                string frontendEmail=prefix+"-frontend@example.invalid";
                string frontendRut=Rut(int.Parse(rut.Split('-')[0])+1);
                Frontend("/api/auth/registro",201,new JObject { ["nombre"]="Test cliente frontend", ["email"]=frontendEmail,
                    ["password"]=password, ["rut"]=frontendRut, ["tipoCliente"]="colegio", ["idRol"]=adminRole });
                int frontUser=Convert.ToInt32(Scalar(c,"SELECT id_usuario FROM USUARIO WHERE correo=@p0",frontendEmail));
                testIds.Add(frontUser);
                customerIds.Add(Convert.ToInt32(Scalar(c,"SELECT id_cliente FROM USUARIO WHERE id_usuario=@p0",frontUser)));
                var frontLogin=Frontend("/api/auth",200,new JObject { ["email"]=frontendEmail,["password"]=password });
                if((string)frontLogin["usuario"]["rol"]!="Cliente") throw new Exception("Frontend assigned an incorrect role");
                if(Convert.ToString(Scalar(c,"SELECT c.tipo_cliente FROM CLIENTE c JOIN USUARIO u ON u.id_cliente=c.id_cliente WHERE u.id_usuario=@p0",frontUser))!="persona") throw new Exception("Public registration accepted a customer type");
                if(frontendCookies.GetCookies(new Uri("http://localhost:3000"))["erp_session"]==null) throw new Exception("Missing session cookie");
                Frontend("/api/cliente/catalogo",200);
                Frontend("/api/cliente/perfil",200);
                foreach(var endpoint in new[]{"/api/administracion/usuarios","/api/inventario","/api/contabilidad","/api/dashboard"}) Frontend(endpoint,403);
                Console.WriteLine("PASS: "+checks+" verificaciones de registro, CRUD, vínculo con Ventas y aislamiento de clientes.");
                return 0;
            } finally {
                using(var cmd=new MySqlCommand("SELECT id_usuario,id_cliente FROM USUARIO WHERE correo LIKE @prefix",c)) {
                    cmd.Parameters.AddWithValue("@prefix",prefix+"%");
                    using(var reader=cmd.ExecuteReader()) while(reader.Read()) {
                        if(!testIds.Contains(reader.GetInt32(0))) testIds.Add(reader.GetInt32(0));
                        if(!reader.IsDBNull(1) && !customerIds.Contains(reader.GetInt32(1))) customerIds.Add(reader.GetInt32(1));
                    }
                }
                foreach(var id in testIds) using(var cmd=new MySqlCommand("DELETE FROM USUARIO WHERE id_usuario=@id AND correo LIKE @prefix",c)) { cmd.Parameters.AddWithValue("@id",id); cmd.Parameters.AddWithValue("@prefix",prefix+"%"); cmd.ExecuteNonQuery(); }
                foreach(var id in customerIds) using(var cmd=new MySqlCommand("DELETE FROM CLIENTE WHERE id_cliente=@id",c)) { cmd.Parameters.AddWithValue("@id",id); cmd.ExecuteNonQuery(); }
                Console.WriteLine("Cuentas de prueba eliminadas.");
            }
        }
    }
}
