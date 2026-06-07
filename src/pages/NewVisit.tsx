import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, MapPin, Loader2, Camera, X, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import BottomNav from "@/components/BottomNav";

const depositos = [
  { key: "A1", label: "A1 - Depositos elevados >40L" },
  { key: "A2", label: "A2 - Depositos <40L removiveis" },
  { key: "B", label: "B - Depositos fixos <40L" },
  { key: "C", label: "C - Vasos de plantas" },
  { key: "D1", label: "D1 - Piscina / reservatorio" },
  { key: "D2", label: "D2 - Poco / elevacao" },
];

const emptyCriadouros: Record<string, number> = {
  A1: 0,
  A2: 0,
  B: 0,
  C: 0,
  D1: 0,
  D2: 0,
};

const sanitizeFileName = (fileName: string) =>
  fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "");

interface ExistingPhoto {
  id: string;
  url: string;
}

const NewVisit = () => {
  const navigate = useNavigate();
  const { visitId } = useParams();
  const { user, prefeituraId, perfil } = useAuth();
  const isEditing = Boolean(visitId);
  const [saving, setSaving] = useState(false);
  const [loadingVisit, setLoadingVisit] = useState(false);
  const [editingImovelId, setEditingImovelId] = useState<string | null>(null);

  const [dataVisita, setDataVisita] = useState(() => new Date().toISOString().split("T")[0]);
  const [seObrigatoria, setSeObrigatoria] = useState(false);
  const [sesDisponiveis, setSesDisponiveis] = useState<{ id: string; semana_epidemiologica: string; ano: number; ciclo: number | null }[]>([]);
  const [seId, setSeId] = useState<string>("");

  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [numQuarteirao, setNumQuarteirao] = useState("");
  const [lado, setLado] = useState("");
  const [tipoImovel, setTipoImovel] = useState("residencial");
  const [risco, setRisco] = useState("baixo");

  const [propNome, setPropNome] = useState("");
  const [propSexo, setPropSexo] = useState("");
  const [propNascimento, setPropNascimento] = useState("");
  const [propDocumento, setPropDocumento] = useState("");

  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  const [criadouros, setCriadouros] = useState<Record<string, number>>(emptyCriadouros);
  const [focos, setFocos] = useState(0);

  const [perifocal, setPerifocal] = useState(false);
  const [perifocalCargas, setPerifocalCargas] = useState(0);
  const [focal, setFocal] = useState(false);
  const [focalCargas, setFocalCargas] = useState(0);
  const [edl, setEdl] = useState(false);
  const [bri, setBri] = useState(false);

  const [resultado, setResultado] = useState("concluida");
  const [observacoes, setObservacoes] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<ExistingPhoto[]>([]);

  useEffect(() => {
    if (!isEditing) {
      captureGeolocation();
    }
  }, [isEditing]);

  useEffect(() => {
    if (!prefeituraId) return;
    void supabase
      .from("configuracoes_prefeitura")
      .select("se_obrigatoria")
      .eq("prefeitura_id", prefeituraId)
      .maybeSingle()
      .then(({ data }) => setSeObrigatoria(!!data?.se_obrigatoria));
  }, [prefeituraId]);

  useEffect(() => {
    if (!prefeituraId || !dataVisita) {
      setSesDisponiveis([]);
      return;
    }

    void supabase
      .from("semanas_epidemiologicas")
      .select("id, semana_epidemiologica, ano, ciclo, data_inicial, data_final")
      .eq("prefeitura_id", prefeituraId)
      .lte("data_inicial", dataVisita)
      .gte("data_final", dataVisita)
      .order("data_inicial", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          setSesDisponiveis([]);
          return;
        }
        setSesDisponiveis((data as any) || []);
        if (!data?.some((item: any) => item.id === seId)) setSeId("");
      });
  }, [prefeituraId, dataVisita, seId]);

  useEffect(() => {
    const loadVisit = async () => {
      if (!isEditing || !visitId || !user) return;

      setLoadingVisit(true);

      let query = supabase
        .from("visitas")
        .select(`
          id,
          agenteid,
          datahora,
          focos,
          resultado,
          observacoes,
          prop_nome,
          prop_sexo,
          prop_nascimento,
          prop_documento,
          semana_epidemiologica_id,
          criadouros,
          tratamentos,
          imovelid,
          fotos (
            id,
            url
          ),
          imoveis (
            id,
            logradouro,
            numero,
            bairro,
            num_quarteirao,
            lado,
            tipoimovel,
            risco,
            latitude,
            longitude
          )
        `)
        .eq("id", visitId);

      if (perfil === "agente") {
        query = query.eq("agenteid", user.id);
      }

      const { data, error } = await query.maybeSingle();
      setLoadingVisit(false);

      if (error || !data) {
        console.error(error);
        toast.error("Nao foi possivel carregar a visita");
        navigate("/dashboard", { replace: true });
        return;
      }

      const visit = data as any;
      const imovel = visit.imoveis;
      const tratamentos = (visit.tratamentos as any) || {};

      setEditingImovelId(visit.imovelid ?? imovel?.id ?? null);
      setDataVisita(visit.datahora ? new Date(visit.datahora).toISOString().split("T")[0] : dataVisita);
      setSeId(visit.semana_epidemiologica_id ?? "");
      setLogradouro(imovel?.logradouro ?? "");
      setNumero(imovel?.numero ?? "");
      setBairro(imovel?.bairro ?? "");
      setNumQuarteirao(imovel?.num_quarteirao ?? "");
      setLado(imovel?.lado ?? "");
      setTipoImovel(imovel?.tipoimovel ?? "residencial");
      setRisco(imovel?.risco ?? "baixo");
      setLat(imovel?.latitude ?? null);
      setLng(imovel?.longitude ?? null);
      setPropNome(visit.prop_nome ?? "");
      setPropSexo(visit.prop_sexo ?? "");
      setPropNascimento(visit.prop_nascimento ?? "");
      setPropDocumento(visit.prop_documento ?? "");
      setCriadouros({ ...emptyCriadouros, ...(visit.criadouros as Record<string, number> | null) });
      setFocos(visit.focos ?? 0);
      setPerifocal(!!tratamentos.perifocal);
      setPerifocalCargas(tratamentos.perifocalCargas ?? 0);
      setFocal(!!tratamentos.focal);
      setFocalCargas(tratamentos.focalCargas ?? 0);
      setEdl(!!tratamentos.edl);
      setBri(!!tratamentos.bri);
      setResultado(visit.resultado ?? "concluida");
      setObservacoes(visit.observacoes ?? "");
      setExistingPhotos((visit.fotos as ExistingPhoto[] | null) ?? []);
    };

    void loadVisit();
  }, [dataVisita, isEditing, navigate, perfil, user, visitId]);

  const captureGeolocation = () => {
    if (!navigator.geolocation) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude);
        setLng(position.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        toast.error("Nao foi possivel capturar a localizacao");
      },
      { enableHighAccuracy: true }
    );
  };

  const handlePhotoAdd = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setPhotos((prev) => [...prev, ...Array.from(event.target.files)]);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const incrementCriadouro = (key: string) => {
    setCriadouros((prev) => ({ ...prev, [key]: prev[key] + 1 }));
  };

  const decrementCriadouro = (key: string) => {
    setCriadouros((prev) => ({ ...prev, [key]: Math.max(0, prev[key] - 1) }));
  };

  const uploadPhotos = async (targetVisitId: string) => {
    for (const photo of photos) {
      const safeName = sanitizeFileName(photo.name);
      const fileName = `${targetVisitId}/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("fotos-visitas").upload(fileName, photo);

      if (uploadError) {
        console.error("Photo upload error:", uploadError);
        throw new Error(`Erro ao enviar foto: ${photo.name}`);
      }

      const { data: urlData } = supabase.storage.from("fotos-visitas").getPublicUrl(fileName);

      const { error: photoInsertError } = await supabase.from("fotos").insert({
        visitaid: targetVisitId,
        url: urlData.publicUrl,
      });

      if (photoInsertError) {
        console.error("Photo metadata insert error:", photoInsertError);
        throw new Error(`Erro ao salvar referencia da foto: ${photo.name}`);
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !prefeituraId) {
      toast.error("Sessao invalida");
      return;
    }
    if (seObrigatoria && !seId) {
      toast.error("Selecione a Semana Epidemiologica");
      return;
    }

    setSaving(true);

    try {
      if (isEditing && visitId && editingImovelId) {
        const { error: imovelError } = await supabase
          .from("imoveis")
          .update({
            logradouro,
            numero,
            bairro,
            num_quarteirao: numQuarteirao,
            lado,
            tipoimovel: tipoImovel,
            risco,
            latitude: lat,
            longitude: lng,
            status: resultado === "concluida" ? "visitado" : "pendente",
          })
          .eq("id", editingImovelId);

        if (imovelError) throw imovelError;

        let visitQuery = supabase
          .from("visitas")
          .update({
            datahora: new Date(`${dataVisita}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
            semana_epidemiologica_id: seId || null,
            criadouros,
            focos,
            tratamentos: { perifocal, perifocalCargas, focal, focalCargas, edl, bri },
            resultado,
            observacoes,
            prop_nome: propNome,
            prop_sexo: propSexo,
            prop_nascimento: propNascimento || null,
            prop_documento: propDocumento,
          })
          .eq("id", visitId);

        if (perfil === "agente") {
          visitQuery = visitQuery.eq("agenteid", user.id);
        }

        const { error: visitError } = await visitQuery;
        if (visitError) throw visitError;

        await uploadPhotos(visitId);
        toast.success("Visita atualizada com sucesso");
      } else {
        const { data: imovel, error: imovelError } = await supabase
          .from("imoveis")
          .insert({
            prefeituraid: prefeituraId,
            logradouro,
            numero,
            bairro,
            num_quarteirao: numQuarteirao,
            lado,
            tipoimovel: tipoImovel,
            risco,
            latitude: lat,
            longitude: lng,
            status: resultado === "concluida" ? "visitado" : "pendente",
          })
          .select("id")
          .single();

        if (imovelError) throw imovelError;

        const { data: visita, error: visitError } = await supabase
          .from("visitas")
          .insert({
            prefeituraid: prefeituraId,
            imovelid: imovel.id,
            agenteid: user.id,
            datahora: new Date(`${dataVisita}T${new Date().toTimeString().slice(0, 8)}`).toISOString(),
            semana_epidemiologica_id: seId || null,
            criadouros,
            focos,
            tratamentos: { perifocal, perifocalCargas, focal, focalCargas, edl, bri },
            resultado,
            observacoes,
            prop_nome: propNome,
            prop_sexo: propSexo,
            prop_nascimento: propNascimento || null,
            prop_documento: propDocumento,
          })
          .select("id")
          .single();

        if (visitError) throw visitError;

        await uploadPhotos(visita.id);
        toast.success("Visita registrada com sucesso");
      }

      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar visita");
    } finally {
      setSaving(false);
    }
  };

  if (loadingVisit) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground active:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">{isEditing ? "Editar Visita" : "Nova Visita"}</h1>
      </header>

      <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5 p-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          {geoLoading ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Capturando localizacao...
            </span>
          ) : lat && lng ? (
            <span className="text-muted-foreground">
              {lat.toFixed(5)}, {lng.toFixed(5)}
            </span>
          ) : (
            <button type="button" onClick={captureGeolocation} className="font-medium text-primary">
              Capturar localizacao
            </button>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Data e Semana Epidemiologica</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="dataVisita">Data da visita</Label>
              <Input
                id="dataVisita"
                type="date"
                value={dataVisita}
                onChange={(event) => setDataVisita(event.target.value)}
                className="h-12 text-base"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>
                SE {seObrigatoria && <span className="text-destructive">*</span>}
              </Label>
              <Select value={seId} onValueChange={setSeId} disabled={sesDisponiveis.length === 0}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder={sesDisponiveis.length === 0 ? "Nenhuma SE valida" : "Selecione"} />
                </SelectTrigger>
                <SelectContent>
                  {sesDisponiveis.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.semana_epidemiologica}/{item.ano}
                      {item.ciclo ? ` - ${item.ciclo}o` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Endereco</h2>
          <div className="space-y-2">
            <Label htmlFor="logradouro">Logradouro</Label>
            <Input id="logradouro" value={logradouro} onChange={(event) => setLogradouro(event.target.value)} placeholder="Rua, Avenida..." className="h-12 text-base" required />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="numero">Numero</Label>
              <Input id="numero" value={numero} onChange={(event) => setNumero(event.target.value)} placeholder="No" className="h-12 text-base" required />
            </div>
            <div className="col-span-2 space-y-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={bairro} onChange={(event) => setBairro(event.target.value)} placeholder="Bairro" className="h-12 text-base" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quarteirao">Num. quarteirao</Label>
              <Input id="quarteirao" value={numQuarteirao} onChange={(event) => setNumQuarteirao(event.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="000" maxLength={3} className="h-12 text-base" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lado">Lado</Label>
              <Input id="lado" value={lado} onChange={(event) => setLado(event.target.value.slice(0, 2).toUpperCase())} placeholder="Ex: AB" maxLength={2} className="h-12 text-base" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo imovel</Label>
              <Select value={tipoImovel} onValueChange={setTipoImovel}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="terreno_baldio">Terreno Baldio</SelectItem>
                  <SelectItem value="publico">Publico</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Risco</Label>
              <Select value={risco} onValueChange={setRisco}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Medio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                  <SelectItem value="fechado">Fechado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Proprietario</h2>
          <div className="space-y-2">
            <Label htmlFor="propNome">Nome</Label>
            <Input id="propNome" value={propNome} onChange={(event) => setPropNome(event.target.value)} placeholder="Nome completo" className="h-12 text-base" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sexo</Label>
              <Select value={propSexo} onValueChange={setPropSexo}>
                <SelectTrigger className="h-12"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="propNasc">Data nascimento</Label>
              <Input id="propNasc" type="date" value={propNascimento} onChange={(event) => setPropNascimento(event.target.value)} className="h-12 text-base" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="propDoc">Cartao CNS / SUS / CPF</Label>
            <Input id="propDoc" value={propDocumento} onChange={(event) => setPropDocumento(event.target.value)} placeholder="Numero do documento" className="h-12 text-base" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Criadouros</h2>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            {depositos.map((deposito) => (
              <div key={deposito.key} className="flex items-center justify-between gap-2">
                <Label className="flex-1 text-sm">{deposito.label}</Label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => decrementCriadouro(deposito.key)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors active:bg-accent"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-10 text-center text-base font-semibold">{criadouros[deposito.key]}</span>
                  <button
                    type="button"
                    onClick={() => incrementCriadouro(deposito.key)}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground transition-colors active:bg-accent"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="focos">Total de focos encontrados</Label>
            <Input id="focos" type="number" min="0" value={focos} onChange={(event) => setFocos(parseInt(event.target.value) || 0)} className="h-12 text-base" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Tratamentos</h2>
          <div className="space-y-4 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="perifocal" checked={perifocal} onCheckedChange={(value) => setPerifocal(!!value)} />
                <Label htmlFor="perifocal" className="text-sm">Perifocal</Label>
              </div>
              {perifocal && (
                <Input type="number" min="0" value={perifocalCargas} onChange={(event) => setPerifocalCargas(parseInt(event.target.value) || 0)} placeholder="Cargas" className="h-9 w-24 text-center" />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="focal" checked={focal} onCheckedChange={(value) => setFocal(!!value)} />
                <Label htmlFor="focal" className="text-sm">Focal</Label>
              </div>
              {focal && (
                <Input type="number" min="0" value={focalCargas} onChange={(event) => setFocalCargas(parseInt(event.target.value) || 0)} placeholder="Cargas" className="h-9 w-24 text-center" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="edl" checked={edl} onCheckedChange={(value) => setEdl(!!value)} />
              <Label htmlFor="edl" className="text-sm">EDL instalada</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="bri" checked={bri} onCheckedChange={(value) => setBri(!!value)} />
              <Label htmlFor="bri" className="text-sm">BRI-Aedes aplicada</Label>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Fotos</h2>
          <div className="flex flex-wrap gap-2">
            {existingPhotos.map((photo) => (
              <div key={photo.id} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                <img src={photo.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
            {photos.map((photo, index) => (
              <div key={index} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                <img src={URL.createObjectURL(photo)} alt="" className="h-full w-full object-cover" />
                <button type="button" onClick={() => removePhoto(index)} className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              <Camera className="h-6 w-6" />
              <input type="file" accept="image/*" multiple onChange={handlePhotoAdd} className="hidden" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Resultado</Label>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="concluida">Concluida</SelectItem>
              <SelectItem value="pendencia">Pendencia</SelectItem>
              <SelectItem value="agendada">Agendada</SelectItem>
              <SelectItem value="fechada">Fechada</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="obs">Observacoes</Label>
          <Textarea id="obs" value={observacoes} onChange={(event) => setObservacoes(event.target.value)} placeholder="Anotacoes adicionais..." className="min-h-[100px] text-base" />
        </div>

        <Button type="submit" size="lg" className="h-14 w-full gap-2 text-base font-semibold" disabled={saving}>
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {isEditing ? "Salvar visita" : "Registrar visita"}
        </Button>
      </form>

      <BottomNav />
    </div>
  );
};

export default NewVisit;
